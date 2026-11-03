import { Redirect } from 'expo-router';

// La primera pantalla de la app es el inicio de sesión
export default function App() {
  return <Redirect href="/login" />;
}
