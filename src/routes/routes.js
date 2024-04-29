import { Router } from 'express';
import computerController from '../controllers/loginController.js';

const apiRoutes = Router()
    .use('/computers', computerController);


export default Router().use('/api', apiRoutes);


