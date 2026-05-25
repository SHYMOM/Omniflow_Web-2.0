import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/stream?type=movie&id=278');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error(e.message, e.response?.data);
  }
}

test();
