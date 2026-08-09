/**
 * Config plugin: отключает системный диалог iOS «Undo ввод текста»,
 * который всплывает при встряхивании телефона (Shake to Undo).
 *
 * В приложении встряхивание — это жест «Шара судьбы», поэтому системная
 * панель Undo мешает и выглядит как ошибка. Отключается одной строкой
 * в AppDelegate: application.applicationSupportsShakeToEdit = NO.
 */
const { withAppDelegate } = require('@expo/config-plugins');

const OBJC_LINE = '  application.applicationSupportsShakeToEdit = NO;';
const SWIFT_LINE = '    application.applicationSupportsShakeToEdit = false';

function patchObjC(contents) {
  if (contents.includes('applicationSupportsShakeToEdit')) return contents;
  // вставляем сразу после открытия didFinishLaunchingWithOptions
  const re = /(didFinishLaunchingWithOptions[^\{]*\{)/;
  if (!re.test(contents)) return contents;
  return contents.replace(re, `$1\n${OBJC_LINE}`);
}

function patchSwift(contents) {
  if (contents.includes('applicationSupportsShakeToEdit')) return contents;
  const re = /(didFinishLaunchingWithOptions[^\{]*\{)/;
  if (!re.test(contents)) return contents;
  return contents.replace(re, `$1\n${SWIFT_LINE}`);
}

module.exports = function withNoShakeToUndo(config) {
  return withAppDelegate(config, (cfg) => {
    const { language, contents } = cfg.modResults;
    if (language === 'swift') {
      cfg.modResults.contents = patchSwift(contents);
    } else if (language === 'objc' || language === 'objcpp') {
      cfg.modResults.contents = patchObjC(contents);
    }
    return cfg;
  });
};
