import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { gethealth } from "../db/index.js"

const healthcheck = asyncHandler(async (req, res) => {
    if(gethealth()){
        const health = {
            message: "System is working fine",
            status: "Ok",
            timestamp:  new Date().toISOString()
        };
    
        res.status(200).json(
            new ApiResponse(200, health, "API is working fine" )
        )
    }else{throw new ApiError(500, "System is not responding")};
    
})

export {
    healthcheck
    }
    