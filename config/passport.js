require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const User = require("../models/userModel");


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {

            try {

                // Check if Google account already exists
                let user = await User.findOne({
                    googleId: profile.id
                });

                if (user) {
                    if (user.isBlocked) {
                        return done(null, false, { message: "Your account has been blocked." });
                    }
                    return done(null, user);
                }

                // Check if email already exists
                const email = profile.emails?.[0]?.value;

                if (!email) {
                    return done(
                        null,
                        false,
                        {
                            message: "Google account does not have an email."
                        }
                    );
                }

                user = await User.findOne({
                    email: email.toLowerCase()
                });

                // Generate a random password for Google users
                const randomPassword = crypto
                    .randomBytes(32)
                    .toString("hex");

                const hashedPassword = await bcrypt.hash(
                    randomPassword,
                    10
                );

                const avatarUrl = profile.photos?.[0]?.value || null;

                if (user) {
                    if (user.isBlocked) {
                        return done(null, false, { message: "Your account has been blocked." });
                    }

                    // Link existing email account with Google
                    user.googleId = profile.id;
                    user.isVerified = true;
                    if (!user.imgUrl && avatarUrl) {
                        user.imgUrl = avatarUrl;
                    }

                    await user.save();

                    return done(null, user);
                }

                // Create new Google user
                user = await User.create({

                    name:
                        profile.displayName ||
                        profile.name?.givenName ||
                        "Google User",

                    email: email.toLowerCase(),

                    password: hashedPassword,

                    googleId: profile.id,

                    imgUrl: avatarUrl,

                    isVerified: true,

                    isAdmin: false,

                    isBlocked: false

                });

                return done(null, user);

            } catch (error) {

                return done(error);

            }

        }
    )
);


// Store user ID in session
passport.serializeUser((user, done) => {

    done(null, user._id);

});


// Retrieve user from session
passport.deserializeUser(async (id, done) => {

    try {

        const user = await User.findById(id);

        done(null, user);

    } catch (error) {

        done(error);

    }

});


module.exports = passport;