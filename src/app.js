import express from 'express';
import routes from './routes/routes.js';
import bodyParser from 'body-parser'
import dotenv from "dotenv";
import cors from 'cors'

dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.listen(process.env.PORT);
app.use(routes);
app.use((req,res)=> {
    res.status(404).send("404: route not found")
});