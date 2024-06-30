
function generateToken() {
    return jwt.sign({ iat: Math.floor(Date.now() / 1000) }, getSecretKey(), { expiresIn: '15m', jwtid: md5(generateString(10)) });
}

