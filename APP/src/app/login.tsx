import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { LogoReparto } from '@/components/logo-reparto';
import { iniciarSesionTransportista } from '@/services/auth';

export default function LoginScreen() {
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [mostrarPin, setMostrarPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formularioCompleto = dni.length > 0 && pin.length > 0;


  /*const ingresar =()=>{
    if(dni=== '1111' && pin === '1234'){
      router.replace('/hojaRuta');
    }
  }*/
 
  // Los datos los valida el back, si algo está mal mostramos el mensaje que manda
  const ingresar = async () => {
    setError(null);
    setLoading(true);
    try {
      const respuesta = await iniciarSesionTransportista(dni, pin);
      // TODO: guardar respuesta.token para mandarlo en los próximos pedidos al backend
      console.log('Sesión iniciada:', respuesta.transportista);
      // Usamos replace y no push para que con "atrás" no se vuelva al login
      // Le pasamos el ID del transportista como parámetro a la siguiente pantalla
      router.replace({
        pathname: '/hojaRuta',
        params: { id: respuesta.transportista.id }
      });
    } catch (e) {
      // Si el back no mandó ningún mensaje mostramos uno general
      setError(e instanceof Error && e.message ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Encabezado */}
        <View style={styles.header}>
          <LogoReparto ancho={220} variante="azul" />
        </View>

        {/* Tarjeta con el formulario */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>

          <Text style={styles.label}>DNI</Text>
          <TextInput
            style={styles.input}
            value={dni}
            onChangeText={(t) => {
              setDni(t);
              setError(null);
            }}
            placeholder="Ej: 12345678"
            placeholderTextColor="#C0C4CC"
            keyboardType="number-pad"
            maxLength={8}
            editable={!loading}
            returnKeyType="next"
          />

          <Text style={styles.label}>PIN</Text>
          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, styles.pinInput]}
              value={pin}
              onChangeText={(t) => {
                setPin(t);
                setError(null);
              }}
              placeholder="••••"
              placeholderTextColor="#C0C4CC"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry={!mostrarPin}
              editable={!loading}
              onSubmitEditing={ingresar}
            />
            <TouchableOpacity style={styles.verPinButton} onPress={() => setMostrarPin(!mostrarPin)}>
              <Text style={styles.verPinText}>{mostrarPin ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ingresarButton, (!formularioCompleto || loading) && styles.ingresarButtonDeshabilitado]}
            onPress={ingresar}
            disabled={!formularioCompleto || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ingresarButtonText}>Ingresar</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.ayuda}>¿Olvidaste tu PIN? Pedile uno nuevo al personal de administración.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6EC',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 30,
  },

  // Encabezado
  header: {
    backgroundColor: '#123C6B',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  // Tarjeta
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: -30, // la tarjeta se monta un poco sobre el encabezado azul
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B1B1F',
    marginBottom: 20,
  },

  // Campos
  label: {
    fontSize: 11,
    color: '#909399',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCDFE6',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#1B1B1F',
    marginBottom: 16,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pinInput: {
    flex: 1,
    letterSpacing: 4,
  },
  verPinButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCDFE6',
    backgroundColor: '#FFFFFF',
  },
  verPinText: {
    fontSize: 13,
    color: '#123C6B',
    fontWeight: '600',
  },

  // Error
  errorBox: {
    backgroundColor: '#f8d7da',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
  },

  // Botón
  ingresarButton: {
    backgroundColor: '#F4661B',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ingresarButtonDeshabilitado: {
    backgroundColor: '#909399',
  },
  ingresarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  ayuda: {
    textAlign: 'center',
    fontSize: 13,
    color: '#909399',
    marginTop: 20,
    marginHorizontal: 32,
  },
});
