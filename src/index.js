import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from './app.js'

dotenv.config({
    path: './env'
})

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("ERROR: ", error);
    })
    
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`server in running on port ${process.env.PORT}`);
    })

})
.catch((err)=>{
    console.log("Mongo connection failed ", err);
})























//Establishing Database connection in the same file
/*
import express from "express";
const app = express()

;(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("ERROR: ", error);
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`App is running on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ", error);
        throw error
    }
})()
*/