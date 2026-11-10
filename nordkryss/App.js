import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

// Nordkryss — the whole game is a single offline HTML file (puzzles, art, sounds)
// rendered inside a native WebView. No network, no accounts.
export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        source={require('./assets/app.html')}
        originWhitelist={['*']}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        textInteractionEnabled={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#bfe0f0' },
  web: { flex: 1, backgroundColor: '#bfe0f0' },
});
