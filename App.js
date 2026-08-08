import React, { useRef } from 'react';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

// Oriona — single-file HTML app (astrology engine + UI + i18n) rendered
// inside a native WebView shell. All astro calculations run on-device,
// inside the WebView's JS engine — no network calls except optional
// Google Fonts (app degrades gracefully offline).

export default function App() {
  const webref = useRef(null);

  // Let the in-app "back" gesture on Android map to WebView history,
  // harmless no-op on iOS.
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webref.current) {
        webref.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <WebView
          ref={webref}
          source={require('./assets/app.html')}
          originWhitelist={['*']}
          style={styles.web}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          domStorageEnabled
          bounces={false}
          overScrollMode="never"
          decelerationRate="normal"
          startInLoadingState={false}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fbf5f2' },
  web: { flex: 1, backgroundColor: '#fbf5f2' },
});
