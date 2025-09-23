const express = require('express')
const app = express()
const port = 3000

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const userController = require('./controllers/userController');

app.get('/', (req, res) => {
  res.send('Hello World!')
})

// Endpoint register user
app.post('/users', userController.register);

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})