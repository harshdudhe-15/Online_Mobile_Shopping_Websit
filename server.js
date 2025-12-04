const express = require('express');
const session =require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

let cart = [
    // Example cart items
    { id: 1, name: 'Product 1', price: 10, quantity: 1, image: 'product1.jpg' },
    { id: 2, name: 'Product 2', price: 20, quantity: 1, image: 'product2.jpg' }
];


// Create an instance of Express
const app = express();
const port = 1000;

// Configure bodyParser middleware
app.use(bodyParser.urlencoded({extended:true}));


app.use(session({
    secret:"secret",
    resave: false,
    saveUninitialized: true
})); 


// Configure EJS as the template engine
app.set('view engine','ejs');
// Set the directory for view templates to the 'views' folder in the current directory
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a Postgres connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to PostgreSQL at:', res.rows[0].now);
    }
});


// Function to get products
function getProducts(callback) {
    pool.query('SELECT * FROM product', (err, results) => {
        if (err) return callback(err);
		console.log('getProducts rows:', results.rows);
        callback(null, results.rows);
    });
}

// Function to remove product from cart
function removeFromCart(cart, id) {
    return cart.filter(product => product.id != id);
}

// Function to calculate cart total
function calculateTotal(cart, req) {
    var total = 0;
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].sale_price) {
            total += cart[i].sale_price * cart[i].quantity;
        } else {
            total += cart[i].price * cart[i].quantity;
        }
    }
    req.session.total = total;
    return total;
}

// Route for the home page
app.get('/',(req,res)=>{
    const sql = 'SELECT * FROM product ORDER BY RANDOM() LIMIT 6'; // Randomly select 6 products
    pool.query(sql, (err, result) => {
        if (err) throw err;
        res.render('index', { product: result.rows });
    });
});

// Route for the products page
app.get('/products',(req,res)=>{
    getProducts((err, products) => {
        if (err) return res.status(500).send(err);  
        res.render('products',{product : products});
    });
});

// Route for the contact us page
app.get('/contact',(req,res)=>{        
        res.render('contact');   
});

// Route for the Offers page
app.get('/offers',(req,res)=>{        
        res.render('offers');  
});

// Route for the about page
app.get('/about',(req,res)=>{
        res.render('about');   
});

//Route for the cart page
app.get('/cart',(req,res)=>{
    var cart =req.session.cart;
    var total = req .session.total;

    res.render('cart', {cart:cart,total:total });   
});

// Fetch cart quantity
app.get('/cart-quantity', (req, res) => {
    const qty = req.session.totalQuantity || 0;
    res.json({ totalQuantity: qty });
});

//To add iteam to the cart
app.post('/add_to_cart', (req, res) => {

    // convert numeric fields
    const id = parseInt(req.body.id, 10);
    const name = req.body.name;
    const description = req.body.description;
    const price = Number(req.body.price);
    const sale_price = req.body.sale_price ? Number(req.body.sale_price) : null;
    const quantity = parseInt(req.body.quantity, 10);
    const image = req.body.image;

    if (!Number.isInteger(id) || !name || isNaN(price) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).send('Invalid product data.');
    }

    const product = { id, name, description, price, sale_price, quantity, image };

    if (!req.session.cart) req.session.cart = [];

    const cart = req.session.cart;
    const existingIndex = cart.findIndex(item => item.id === id);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push(product);
    }

    // recalc totals
    calculateTotal(req.session.cart, req);
    req.session.totalQuantity = req.session.cart.reduce((s, i) => s + i.quantity, 0);

    if (req.xhr) {
        res.json({ totalQuantity: req.session.totalQuantity });
    } else {
        res.redirect('/cart');
    }
});

//To remove the iteam from the cart
app.post('/remove_from_cart', (req, res) => {
    const id = parseInt(req.body.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    req.session.cart = req.session.cart.filter(p => p.id !== id);
    calculateTotal(req.session.cart, req);
    req.session.totalQuantity = req.session.cart.reduce((s, i) => s + i.quantity, 0);
    res.redirect('/cart');
});

//To update the quantity of the product from the cart
app.post('/update_cart', (req, res) => {
    const itemId =parseInt(req.body.id, 10);
    const newQuantity = parseInt(req.body.quantity, 10);

    // Find the item in the cart (assuming cart is stored in session)
    let cart = req.session.cart || [];
    let item = cart.find(i => i.id === itemId);

    if (item) {
        // Update the quantity
        item.quantity = newQuantity;

        // Calculate the total for this item and the entire cart
        let itemTotal = item.quantity * (item.sale_price || item.price);
        let total = calculateTotal(req.session.cart, req);
        req.session.totalQuantity = req.session.cart.reduce((s, i) => s + i.quantity, 0);
        // Send the updated total back to the client
        res.json({ total,itemTotal });
    } else {
        // Item not found, return an error or handle it accordingly
        res.status(404).json({ error: 'Item not found' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});