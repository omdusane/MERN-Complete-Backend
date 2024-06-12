import mongoose from "mongoose";
import {DB_NAME} from "../constants.js";

let health = false;

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n Database Connected! DB HOST: ${connectionInstance.connection.host}`);
        health = true;

    } catch (error) {
        console.log("Mongodb connection error ", error);
        process.exit(1)
    }
}
const gethealth = () =>  health; 
export {gethealth}
export default connectDB