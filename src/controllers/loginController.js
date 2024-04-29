import { Router } from 'express';
import { pool } from '../mysqlConnector.js'
import jwt from "jsonwebtoken";
import argon2 from "argon2";

const router = Router();
function getSecretKey()
{
    return 'chiave supersegreta';
}

router.post('/login',   async (req, res) =>  {
    const credentials = req.body;
    if (!credentials.username || !credentials.password) {
        return res.status(401).json({message : "invalid request"})
    }
    try {
        const rows = await pool.query('SELECT * FROM Login WHERE username = ?', [credentials.username], async (error, results, fields) => {
            if (results) {
                if (await argon2.verify(results[0].password, credentials.password)) {
                    const token = jwt.sign({ username: credentials.username }, getSecretKey(), { expiresIn: '1h' });
                    res.status(200).json({message: 'success', token});
                } else {
                    res.status(401).json({message : "Invalid Credentials"})
                }
            } else {
                return res.status(404).json({ message: 'User not found' });
            }
        });
    } catch (error) {
        console.error(error);
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

export default router;