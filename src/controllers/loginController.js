import { Router } from 'express';
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

router.post('/register',   async (req, res) =>  { //metodo di testing per registrare utenti e memorizzarne la password cifrata e salata da argon2
    const credentials = req.body;
    if (!credentials.username || !credentials.password) {
        return res.status(401).json({message : "Invalid request"})
    }
    try {
        pool.query('INSERT INTO Login VALUES(1, ?, ?, 1)', [credentials.username, await argon2.hash(credentials.password)], (error, results, fields) => {
            console.log(results);
            console.log(fields);
            console.log(error);
        });
        res.status(200).json({ message: 'success' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
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

export default router;