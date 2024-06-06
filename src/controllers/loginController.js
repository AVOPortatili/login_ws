import {Router} from 'express';
import { pool } from '../mysqlConnector.js'
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let activeTokens = [];
const router = Router();

//email setup
const email = "ritiropc@outlook.com"
const transport = nodemailer.createTransport({
    service : 'outlook',
    auth : {
        user: email,
        pass: process.env.EMAIL_PASSWORD
    }
});

function getSecretKey() {
    return process.env.SECRET_KEY;
}

function isTokenExpired(token) {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
    const decoded = JSON.parse(decodedJson)
    const exp = decoded.exp;
    const expired = (Date.now() >= exp * 1000)
    return expired
  }

router.post('/login',   async (req, res) =>  {
    console.log(req.ip)
    const credentials = req.body;
    if (!credentials.username || !credentials.password) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        const rows = await pool.query('SELECT password, ruolo FROM login l INNER JOIN utenti u ON u.id=l.utente WHERE username = ?', [credentials.username], async (error, results, fields) => {
            if (results && results.length>0) {
                if (await argon2.verify(results[0].password, credentials.password)) {
                    const token = jwt.sign({ username: credentials.username }, getSecretKey(), { expiresIn: '1h' });
                    activeTokens.push({token: token, address: req.ip})
                    res.status(200).json({message: 'success', role: results[0].ruolo, token});
                } else {
                    res.status(401).json({message : "Invalid Credentials"})
                }
            } else {
                return res.status(404).json({ message: 'User not found' });
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/user/register',   async (req, res) =>  {
    const user_info = req.body;
    if (!user_info.nome || !user_info.cognome || !user_info.email || !user_info.ruolo) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        return await pool.query('INSERT INTO utenti VALUES(?,?,?,?,?)', [null, user_info.nome, user_info.cognome, user_info.email, user_info.ruolo], (error, results, fields) => {
            console.log("INSERTING INTO utenti (id, nome, cognome, email, ruolo)");
            console.log("results= " + JSON.stringify(results));
            console.log("fields= "  + fields);
            console.log("error= "   + error);
            console.log("-----------------------------")
            const id = results.insertId;
            const username = user_info.nome[0].replaceAll(' ', '').concat(user_info.cognome.replaceAll(' ', ''));
            const password  = generateString(7);
            send_email(username, password, user_info.email)
            console.log("sending response")
            res.status(200).json({message : "user created successfully"});
            return set_credentials(username, password, id, res)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/user/credentials',   async (req, res) =>  { //metodo di testing per registrare utenti e memorizzarne la password cifrata e salata da argon2
    //todo: aggiungi controllo della vecchia password
    const body = req.body;
    try{
        return await set_credentials(body.username, body.password, body.userId, res)
            .then(() => res.status(200).json({message : "credentials created"}))
    } catch (e) {
        console.error(e);
    }
})

router.post('/verify', async (req, res) => {
    let tokenIndex;
    for (let index = 0; index < activeTokens.length; index++) {
        if (activeTokens[index].token===req.body.token && activeTokens[index].address===req.ip) {
            tokenIndex = index;
            break;
        }
    }
    if (tokenIndex!==undefined && isTokenExpired(activeTokens[tokenIndex].token)!==true) {
        res.status(200).json({message: "success"})        
    } else {
        res.status(200).json({message: "failure"})
    }
})

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const generateString =  (length) => { //placeholder per generare password e username
    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const set_credentials = async (username, password, userId, res) => {
    if (!username || !password || !userId) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        return await pool.query('INSERT INTO login VALUES(?,?,?,?)', [null, username, await argon2.hash(password), userId], (error, results, fields) => {
            console.log("TRIED INSERTING INTO login");
            console.log("results= " + JSON.stringify(results));
            console.log("fields= "  + fields);
            console.log("error= "   + error);
            console.log("-----------------------------")
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const send_email = (username, password, emailClient) => {
    const mail_options = {
        from: email,
        to: emailClient,
        subject: 'username e password',
        text: 'username=\'' + username + "\', password=\'" + password + '\''
    };
    transport.sendMail(mail_options, (error, info) => {
        if (error) {
            console.log(error)
        }else{
            console.log("email sent: " + info.response)
        }
    })
}

export default router;