import * as Haptics from 'expo-haptics'
import { ActionSheetIOS, Alert, Platform } from 'react-native'
import type { TFunction } from '@/core/i18n/create'
import type { Theme } from '@/core/theme'
import { copyText } from '../conversation/copy-text'

/** Longest command shown in the menu's title. */
const TITLE_MAX = 200

/**
 * Long-press menu of a command in the conversation (#477): Copy, and Run on the computer (which
 * opens the Run command sheet; nothing runs from here). The native action sheet on iOS, like the
 * link menu; an alert with the same choices on Android.
 */
export function showCommandMenu(
  command: string,
  { t, theme, onRun }: { t: TFunction; theme: Theme; onRun: () => void },
): void {
  const copy = () => void copyText(command, t('conversation.copy.copied'), { toast: true })
  const title = command.length > TITLE_MAX ? `${command.slice(0, TITLE_MAX - 1)}…` : command
  if (Platform.OS === 'ios') {
    void Haptics.selectionAsync()
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [t('commands.copyCommand'), t('commands.runHere'), t('common.cancel')],
        cancelButtonIndex: 2,
        userInterfaceStyle: theme.scheme,
        tintColor: theme.colors.accentText,
      },
      (index) => {
        if (index === 0) copy()
        else if (index === 1) onRun()
      },
    )
    return
  }
  Alert.alert(t('commands.title'), title, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('commands.copyCommand'), onPress: copy },
    { text: t('commands.runHere'), onPress: onRun },
  ])
}
