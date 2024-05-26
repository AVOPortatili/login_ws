import {Router} from 'express';
import { pool } from '../mysqlConnector.js'
import jwt from "jsonwebtoken";
import argon2 from "argon2";
let activeTokens = [];
const router = Router();

function getSecretKey()
{
    return 'chiave supersegreta';
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

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const generateString =  (length) => { //placeholder per generare password e username
    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const register = async (username, password, userId, res) => {
    if (!username || !password || !userId) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        return await pool.query('INSERT INTO login VALUES(?,?,?,?)', [null, username, await argon2.hash(password), userId], (error, results, fields) => {
            console.log("TRIED INSERTING INTO login");
            console.log("results= " + results);
            console.log("fields= "  + fields);
            console.log("error= "   + error);
            const id = results.insertId;
            return pool.query('UPDATE utenti SET id_login=? WHERE id = ?', [id, userId], (error, results, fields) => {
                console.log("UPDATING utenti WITH id_login");
                console.log("results= " + results);
                console.log("fields= "  + fields);
                console.log("error= "   + error);
                return res.status(200).json({ message: 'success' });
            })
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

router.post('/user/info',   async (req, res) =>  {
    const user_info = req.body;
    if (!user_info.nome || !user_info.cognome || !user_info.email || !user_info.ruolo) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        return await pool.query('INSERT INTO utenti VALUES(?,?,?,?,?,?)', [null, user_info.nome, user_info.cognome, user_info.email, user_info.ruolo, null], (error, results, fields) => {
            console.log("INSERTING INTO utenti");
            console.log("results= " + results);
            console.log("fields= "  + fields);
            console.log("error= "   + error);            const id = results.insertId;
            return register(generateString(4), generateString(5), id, res)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/user/credentials',   async (req, res) =>  { //metodo di testing per registrare utenti e memorizzarne la password cifrata e salata da argon2
    const body = req.body;
    return await register(body.username, body.password, body.userId, res)
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

export default router;