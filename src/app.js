import express from 'express';
import routes from './routes/routes.js';
import bodyParser from 'body-parser'
import cors from 'cors'

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.listen(8080); //todo: metti in env
app.use(routes);
app.use((req,res)=> {
    res.status(404).send("404: route not found")
});