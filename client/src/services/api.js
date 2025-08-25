import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export const api = {
  async callFunction(name, payload) {
    const { data } = await axios.post(`${API_BASE}/fn/${name}`, payload);
    return data.result;
  }
};
