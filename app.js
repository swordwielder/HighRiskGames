//requirements
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const favicon = require('serve-favicon');
const User = require('./models/user');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const MongoDBStore = require("connect-mongo")(session);
// const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/gambitgames';
require('dotenv').config();
//'mongodb://localhost:27017/yelp-camp'


//MongoDB connection
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});



const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
const route = express.Router();
app.use('/v1', route);


// app.use(bodyParser);
//set app to use the different directories for the views path and be able to use ejs files.
app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views'),
    path.join(__dirname, 'views/users/'),
    path.join(__dirname, 'views/partials/'),
    path.join(__dirname, 'views/layouts/'),
    path.join(__dirname, 'views/sports/'),
    path.join(__dirname, 'public/javascripts/'),  
        ]);

const secret = process.env.SECRET || 'thisshouldbeabettersecret!';
const store = new MongoDBStore({
    url: dbUrl,
    secret,
    touchAfter: 24*60*60
});



//initialize the session for the brwoser to store information
const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));
app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')))
store.on("error", function(e){
    console.log('session store error', e)
})

// if current user is the session user move to next step
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    // res.locals.success = req.flash('success');
    // res.locals.error = req.flash('error');
    next();
})

//use the favicon for the website
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

//if no user is in session, go to login path
const requireLogin = (req, res, next) => {
    if (!req.session.user_id) {
        return res.redirect('/login')
    }
    next();
}

//root path
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
//     const { username = 'Annaymous' } = req.query;
//     req.session.username = username;
    res.render('register')
})


//method to make a temporary password.
makepass=(length) => {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

//forgot password path 
app.get('/forgotpassword', (req, res) => {
    res.render('forgotpassword')
})


app.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;
    console.log('the email is')
    console.log(email)
    temppass = makepass(12)
    console.log('email:')
    console.log(process.env.GAMBIT_EMAIL)
    console.log('password')
    console.log(process.env.GAMBIT_PASS)

    try{
        
        const transporter = nodemailer.createTransport({
            port: 465,               // true for 465, false for other ports
            secure: true,
            host: "smtp.gmail.com",
            auth: {
                user: process.env.GAMBIT_EMAIL,
                pass: process.env.GAMBIT_PASS,
            },
            protocol: "ssl",    //port: 587 or 465 (587 for tls, 465 for ssl)
            ssl: {
                // do not fail on invalid certs
                rejectUnauthorized: false
            }
        });


        const foundUser = await User.findAndUpdatePW(email)
        // If User is found from the database, then attempt to update the password.
        if (foundUser){
            
            const query = { email: email};
            const password = await bcrypt.hash(temppass, 12)
            const newValues = { $set: {password: password, text: temppass , passwordLastModified: Date.now} };
            db.collection("users").updateOne(query, newValues, function(err,res) {
                if (err) throw err;
                console.log("1 document updated");
            })
            console.log(foundUser)
            
            //Prepares the message Body
            const mailOptions = {
                from: 'gambitprofit@gmail.com',  // sender address
                    to: email,   // list of receivers
                    subject: "Here's your Temporary password",
                    text: 'Gambit Games',
                    html: `<b>Hi! <br/> Your Temporary Password is ${temppass}<br/>`,
                };

            //Sends the message
            transporter.sendMail(mailOptions, function(err, info) {
                if(err){
                    console.log(err)
                }else{
                    console.log(info);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            });

            res.send("New Temporary Password sent to " + email);
        }else{
            //Have to find some ways to display user not found to the main screen
            console.log("User Not found")
        }
        
        
    } catch(e){
        console.log(e)
    }
    
    
})

//changing password
app.get('/changepassword', (req,res) => {
    res.render('changepassword')
})

//nba odds path
app.get('/nba', (req,res) => {
    res.render('nba')
})

//post request to register path
app.post('/register', async (req, res) => {
    const { password, username, email, confirmPassword } = req.body;
    // const hash = awa
    console.log('request.body from app.js')
    console.log(req.body)
    console.log('reqest body values')
    console.log(password,username,email, confirmPassword)
    const user = new User({ 
        username, 
        password, 
        email,
        text:confirmPassword
     })
    await user.save();
    console.log('This is the user from the app.js')
    console.log(user)
    req.session.user_id = user._id;
    res.redirect('/gamestoday')
    
})


//login path
app.get('/login', (req, res) => {
    res.render('login')
})

//logout post request to log out
app.post('/logout', (req,res) => {
    req.session.user_id = null;
    res.redirect('/login')
})

//post request to login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body)
    
    try{
        const validateuser = await User.findAndValidate(username,password);
        console.log('validate user console log')
        console.log(validateuser)
    // const foundUser = await User.findAndValidate(username, password);
        if (validateuser) {
            console.log(validateuser)
            req.session.user_id = validateuser._id;
            res.redirect('/gamestoday');
        }else{
            console.log('This should flash invalid/username/password')
            // req.flash('notify', 'Invalid username/pw')
            res.redirect('/login')
        }
        
    }catch (e){
        // req.flash('error', e.message)
        console.log('This should flash Non existant username')
        // req.flash('notify', 'None existent username/pw')
        res.redirect('/login')
    }
    
})

//post request to logout
app.post('/logout', (req, res) => {
    // req.session.user_id = null;
    req.session.destroy();
    // req.session.destroy();
    res.redirect('/login');
})

//shows the games for today on gambit
app.get('/gamestoday', requireLogin, (req, res) => {
    // if (!req.session.user_id){
    //     res.redirect('/login')
    // }
    res.render('gameoutput')
})

//testing
app.get('/test', (req, res) => {
    res.send('nice, you found the testing page, but keep this a secret!  ;) ');
});

app.get('/donate', (req, res) => {
    res.render('donate')
});

//separate page
app.get('/profit', (req, res) => {
    res.render('profit');
});


//random page for testing
app.get('/city', (req,res) => {
    res.render('city')
})



//catches all other pages if there's no end point found for the url.
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err })
})

const port = process.env.PORT || 4000;

//listens to port 4000
app.listen(port, () => {
    console.log('Serving on port 4000')
})
