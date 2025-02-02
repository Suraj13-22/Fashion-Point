const port=4000;
require("dotenv").config();
const PORT = process.env.PORT || 4000;
const bcrypt = require('bcryptjs');
const express=require("express");
const app=express();
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const multer=require("multer");
const path=require("path");
const cors=require("cors");
const { request } = require("http");
const JWT_SECRET=process.env.JWT_SECRET;
app.use(express.json());
app.use(cors());

// Database Connection With MongoDB
//mongoose.connect("mongodb+srv://katiyarpknitian:QV2DgTWD69UtE5Ws@ecommerceh.4eogfrx.mongodb.net/ecommerce")
mongoose.connect(process.env.MONGODB_URL,{
    useNewUrlParser:true,
    useUnifiedTopology:true,
})
// API creation

app.get("/",(req,res)=>{
res.send("Express App is Running")

})

// Image Storage Engine

const storage=multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
    return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload=multer({storage:storage})

// Creating Upload Endpoint for images
app.use('/images',express.static('upload/images'))
app.post("/upload",upload.single('product'),(req,res)=>{
res.json({
    success:1,
    image_url:`http://localhost:${port}/images/${req.file.filename}`
})
})

// Schema for Creating Products

const Product=mongoose.model("Product",{
 id:{
    type:Number,
    required:true,
 },
 name:{
    type:String,
    required:true,
 },
 image:{
    type:String,
    required:true,
 },
 category:{
    type:String,
    required:true,
 },
 new_price:{
    type:Number,
    required:true,
 },
 old_price:{
    type:Number,
    required:true,
 },
 date:{
    type:Date,
    default:Date.now,
 },
 available:{
    type:Boolean,
    default:true,
 }
})

app.post('/addproduct',async(req,res)=>{
    let products=await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array=products.slice(-1);
        let last_product=last_product_array[0];
        id=last_product.id+1;
    }
    else {
        id=1;
    }
    const product=new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

// API for deleting products
app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("removed");
    res.json({
        success:true,
        name:req.body.name,
    })
})

// API for getting all products
app.get('/allproducts',async(req,res)=>{
    let products=await Product.find({});
    console.log("all products fetched");
    res.send(products);
})

// schema for user model
const Users=mongoose.model('Users',{
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now
    }
})

// creating Endpoint for registering the user
app.post('/signup',async(req,res)=>{
    let check=await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false,errors:"existing user found with same email address"})
    }
    let cart ={};
    for(let i=0;i<300;i++){
        cart[i]=0;
    }
    // encrypting the password
    const salt =await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const user=new Users({
        name:req.body.username,
        email:req.body.email,
        password:hashedPassword,
        cartData:cart,
    })
    await user.save();
// creating json web token
    const data={
        user:{
           id:user.id
        }
    }
    const token=jwt.sign(data,JWT_SECRET);
    res.json({success:true,token});
})

// Creating Endpoint for login
app.post('/login',async (req,res)=>{
let user=await Users.findOne({email:req.body.email});
if(user){
    const passCompare = await bcrypt.compare(req.body.password, user.password);

    if(passCompare){
        const data={
            user:{
                id:user.id
            }
        }
        const token=jwt.sign(data,JWT_SECRET);
        res.json({success:true,token});
    }
    else{
        res.json({success:false,errors:"Wrong Password entered"});
    }
}
else{
    res.json({success:false,errors:"Wrong Email Id"});
}
})

// Creating endpoint for newcollection data
app.get('/newcollections',async(req,res)=>{
let products=await Product.find({});
let newcollection=products.slice(1).slice(-8);
console.log("Newcollection Fetched");
res.send(newcollection);
})

//creating end point for popular for women

app.get('/popularinwomen',async(req,res)=>{
    let products=await Product.find({category:"women"})
    let popular_in_women=products.slice(0,4);
    console.log("popular in women fetched");
    res.send(popular_in_women);
})

// creating middleware to fetch user
const fetchUser=async(req,res,next)=>{
    const token=req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"
        })
    }
    else{
        try{
          const data=jwt.verify(token,JWT_SECRET);
          req.user=data.user;
          next();
        }catch (error){
            res.status(401).send({errors:"please authenticate using a valid token"})
        }
    }
}
//creating endpoint for adding products in cart data

app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("Added",req.body.itemId);
let userData=await Users.findOne({_id:req.user.id});
userData.cartData[req.body.itemId]+=1;
await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
res.send("Added")
})

//creating endpoint to remove product from cartdata

app.post('/removefromcart',fetchUser,async(req,res)=>{
    console.log("removed",req.body.itemId);
    let userData=await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId]-=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("removed")
})

//creating end point to get cartdata
app.post('/getcart',fetchUser,async(req,res)=>{
    console.log("GetCart");
    let userData=await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.listen(PORT,(error)=>{
if(!error){
    console.log("Server Running on Port" +PORT);
}
else{
    console.log("Error :" +error) 
}
})
