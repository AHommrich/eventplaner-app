import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { API_BASE } from '../constants/env';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('guest_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _blocked = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.code === 'app_blocked') {
      if (!_blocked) {
        _blocked = true;
        router.replace('/blocked');
      }
      return new Promise(() => {}); // schlucken — kein catch/Alert feuert
    }
    return Promise.reject(error);
  }
);

export function clearBlocked() {
  _blocked = false;
}

export default api;
