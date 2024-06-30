import jwt from "jsonwebtoken";
const token = jwt.sign({}, 'chiave', { expiresIn: '15m', jwtid: "username" });
console.log(token)