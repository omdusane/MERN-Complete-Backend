import {User} from "../models/user.model.js";
import {ApiError} from "../utils/ApiError.js";




const generateAccessAndRefreshTokens = async(userId)=>{
    try {
            const user = await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshToken = refreshToken
            // validateBeforeSave set it to false to avoid mongoose models kicking in
            await user.save({validateBeforeSave: false})

            return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while Generating referesh and access Token")
    }
}

export {generateAccessAndRefreshTokens}