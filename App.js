import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, BackHandler, Platform, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import * as Notifications from 'expo-notifications';

// Oriona — the whole app is a single HTML file (astrology engine + UI + i18n)
// rendered inside a native WebView. Everything is computed on the device.
// The only native responsibility is the subscription: StoreKit is not reachable
// from inside a WebView, so purchases run out here and the result is pushed
// back into the page.

const ENTITLEMENT = 'plus';

// Daily local reminder ("your forecast is ready"), scheduled fully on-device.
const REMINDER_BODY = {
  ru: 'Твой прогноз на сегодня готов ✨',
  uk: 'Твій прогноз на сьогодні готовий ✨',
  en: 'Your forecast for today is ready ✨',
  es: 'Tu pronóstico de hoy está listo ✨',
  fr: 'Ton horoscope du jour est prêt ✨',
};

async function setDailyReminder(on, lang) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!on) return;
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted && !(perm.ios && perm.ios.status >= 2)) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Oriona', body: REMINDER_BODY[lang] || REMINDER_BODY.en, sound: false },
      trigger: { hour: 9, minute: 30, repeats: true },
    });
  } catch (e) { /* reminders are best-effort */ }
}

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};
const RC_KEY = Platform.select({
  ios: extra.revenuecatIosKey,
  android: extra.revenuecatAndroidKey,
});

export default function App() {
  const webref = useRef(null);
  const premiumRef = useRef(false);

  // Push a state object into the page. The page may not have finished loading
  // yet, so it queues anything that arrives early (see __oriona_setStore).
  const send = useCallback((payload) => {
    if (!webref.current) return;
    const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webref.current.injectJavaScript(
      `window.__orionaStore && window.__orionaStore(JSON.parse('${json}'));true;`
    );
  }, []);

  const isActive = (info) =>
    !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT]);

  const pushOffering = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings && offerings.current;
      const pkg = current && (current.monthly || (current.availablePackages || [])[0]);
      if (!pkg) { send({ ready: false, reason: 'no-offering' }); return; }
      const p = pkg.product;
      const intro = p.introPrice;
      send({
        ready: true,
        price: p.priceString,
        trialDays: intro && intro.periodUnit === 'DAY' ? intro.periodNumberOfUnits
                 : intro && intro.periodUnit === 'WEEK' ? intro.periodNumberOfUnits * 7
                 : 0,
      });
    } catch (e) {
      send({ ready: false, reason: 'offering-failed' });
    }
  }, [send]);

  useEffect(() => {
    let listener;
    (async () => {
      if (!RC_KEY) { send({ ready: false, reason: 'no-key' }); return; }
      try {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
        await Purchases.configure({ apiKey: RC_KEY });
        const info = await Purchases.getCustomerInfo();
        premiumRef.current = isActive(info);
        send({ premium: premiumRef.current });
        listener = Purchases.addCustomerInfoUpdateListener((i) => {
          premiumRef.current = isActive(i);
          send({ premium: premiumRef.current });
        });
        await pushOffering();
      } catch (e) {
        send({ ready: false, reason: 'init-failed' });
      }
    })();
    return () => { if (listener && listener.remove) listener.remove(); };
  }, [send, pushOffering]);

  const buy = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings && offerings.current;
      const pkg = current && (current.monthly || (current.availablePackages || [])[0]);
      if (!pkg) { send({ busy: false, error: 'unavailable' }); return; }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      send({ busy: false, premium: isActive(customerInfo) });
    } catch (e) {
      // A cancelled purchase is a normal outcome, not an error to shout about.
      send({ busy: false, error: e && e.userCancelled ? null : 'failed' });
    }
  }, [send]);

  const restore = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      const ok = isActive(info);
      send({ busy: false, premium: ok, restored: ok ? 'yes' : 'none' });
    } catch (e) {
      send({ busy: false, error: 'failed' });
    }
  }, [send]);

  const onMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (e) { return; }
    if (!msg || !msg.type) return;
    if (msg.type === 'hello') {
      // The page just (re)declared its handler; replay the state it may have missed.
      send({ premium: premiumRef.current });
      pushOffering();
    }
    else if (msg.type === 'buy') { send({ busy: true }); buy(); }
    else if (msg.type === 'restore') { send({ busy: true }); restore(); }
    else if (msg.type === 'openUrl' && typeof msg.url === 'string' && /^https:\/\//.test(msg.url)) {
      Linking.openURL(msg.url);
    }
    else if (msg.type === 'notify') {
      setDailyReminder(!!msg.on, typeof msg.lang === 'string' ? msg.lang : 'en');
    }
  }, [buy, restore, send, pushOffering]);

  // The in-app back gesture on Android maps to WebView history; no-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webref.current) { webref.current.goBack(); return true; }
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
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={'window.__ORIONA_NATIVE__=true;true;'}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fbf5f2' },
  web: { flex: 1, backgroundColor: '#fbf5f2' },
});
