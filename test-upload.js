const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    const form = new FormData();
    form.append('files[]', fs.createReadStream('./teste.txt'));
    form.append('email', 'teste@exemplo.com');
    form.append('telefone', '11999999999');

    const response = await fetch('http://localhost:3000/api/lead-upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const json = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', json);
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

testUpload();
