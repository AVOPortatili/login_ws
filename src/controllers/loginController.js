import {Router} from 'express';
import { pool } from '../mysqlConnector.js'
import jwt from "jsonwebtoken";
import md5 from "md5"
import argon2 from "argon2";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
//Bisognerebbe fare un refactor separando: ws, gestione token e gestione email
dotenv.config();

let activeTokens = [];
const router = Router();

//email setup
const email = process.env.EMAIL_ADDRESS
const transport = nodemailer.createTransport({
    service : process.env.EMAIL_SERVICE,
    auth : {
        user: email,
        pass: process.env.EMAIL_PASSWORD
    }
});

function isTokenExpired(token) {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
    const decoded = JSON.parse(decodedJson)
    const exp = decoded.exp;
    const expired = (Date.now() >= exp * 1000)
    return expired
}
function getSecretKey() {
    return process.env.SECRET_KEY;
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
                console.log(await argon2.verify(results[0].password, credentials.password))
                if (await argon2.verify(results[0].password, credentials.password)) {
                    const token = jwt.sign({ iat: Math.floor(Date.now() / 1000) }, getSecretKey(), { expiresIn: '15m', jwtid: md5(generateString(10)) });
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

router.post('/register',   async (req, res) =>  {
    const user_info = req.body;
    console.log(user_info)
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
            const username = (user_info.nome[0].replaceAll(' ', '').concat(user_info.cognome.replaceAll(' ', ''))).toLowerCase();
            const password  = generateString(7);
            send_email(user_info.email, 'Credenziali Ritiro PC', 'Ecco le credenziali per accedere alla piattaforma:\nusername:\'' + username + "\', password:\'" + password + '\'')
            console.log("sending response")
            return set_credentials(username, password, id, res)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/update',   async (req, res) =>  { //metodo di testing per registrare utenti e memorizzarne la password cifrata e salata da argon2
    const body = req.body;
    console.log(body)
    if (!body.username || !body.oldPassword || !body.newPassword) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        const rows = await pool.query('SELECT password, email FROM login l INNER JOIN utenti u ON u.id=l.utente WHERE username = ?', [body.username], async (error, results, fields) => {
            if (results && results.length>0) {
                let user_email = results[0].email
                console.log(user_email)
                if (await argon2.verify(results[0].password, body.oldPassword)) {
                    const rows = await pool.query('UPDATE login SET password = ? WHERE username = ?', [await argon2.hash(body.newPassword), body.username], async (error, results, fields) => {
                        if(error) {
                            console.log(error)
                            res.status(500).json({ message: 'Internal server error' });
                        } else {
                            res.status(200).json({message: 'success'})
                            send_email(user_email, "Cambio Password Ritiro PC", "La password sulla piattaforma per il Ritiro PC è stata cambiata!")
                        }
                    })
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

router.post('/token/verify', async (req, res) => {
    verifyToken(req.body.token) ? r = "valid" : r = "not valid" 
    res.status(200).json({message : r})
})

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const generateString = (length) => { //placeholder per generare password e username
    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength)); //oh hell nah! Math.random() per una password
    }
    return result;
}

const verifyToken = async (token) => {
    let tokenIndex;
    for (let index = 0; index < activeTokens.length; index++) {
        if (activeTokens[index].token===token && activeTokens[index].address===req.ip) {
            tokenIndex = index;
            break;
        }
    }
    return (tokenIndex!==undefined && isTokenExpired(activeTokens[tokenIndex].token)!==true);
}

const set_credentials = async (username, password, userId, res) => {
    if (!username || !password || !userId) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        password = password.trim()
        console.log(password)
        console.log(await argon2.hash(password))
        await pool.query('INSERT INTO login VALUES(?,?,?,?)', [null, username, await argon2.hash(password), userId], (error, results, fields) => {
            console.log("TRIED INSERTING INTO login");
            console.log("results= " + JSON.stringify(results));
            console.log("fields= "  + fields);
            console.log("error= "   + error);
            console.log("-----------------------------")
        });
        return res.status(200).json({message: "success"})
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const send_email = (emailClient, subject, text) => {
    const mail_options = {
        from: email,
        to: emailClient,
        subject: subject,
        text: text
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