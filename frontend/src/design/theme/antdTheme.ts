import { theme as antd, type ThemeConfig } from 'antd';
import { semantic, type ThemeName } from '../tokens/semantic';
import { typography } from '../tokens/typography';
import { radius } from '../tokens/radius';

export function getAntdTheme(mode: ThemeName): ThemeConfig {
  const s = semantic[mode].color;
  const algorithm = mode === 'dark' ? antd.darkAlgorithm : antd.defaultAlgorithm;

  return {
    algorithm,
    token: {
      colorPrimary:     s.accent.primary,
      colorInfo:        s.status.info.fg,
      colorSuccess:     s.status.success.fg,
      colorWarning:     s.status.warning.fg,
      colorError:       s.status.danger.fg,
      colorBgBase:      s.bg.app,
      colorTextBase:    s.text.primary,
      colorBorder:      s.border.default,
      colorBorderSecondary: s.border.subtle,
      borderRadius:     parseInt(radius.md),
      borderRadiusLG:   parseInt(radius.lg),
      borderRadiusSM:   parseInt(radius.sm),
      fontFamily:       typography.fontFamily.ui,
      fontFamilyCode:   typography.fontFamily.mono,
      fontSize:         14,
      fontSizeLG:       16,
      fontSizeSM:       12,
    },
    components: {
      Card: {
        borderRadiusLG: parseInt(radius.lg),
        colorBgContainer: s.bg.elevated,
      },
      Button: {
        borderRadius: parseInt(radius.md),
        controlHeight: 36,
        fontWeight: 500,
      },
      Table: {
        colorBgContainer: s.bg.elevated,
        headerBg: s.surface.subtle,
        rowHoverBg: s.surface.hover,
        rowSelectedBg: s.surface.selected,
        borderColor: s.border.subtle,
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: s.surface.hover,
        itemSelectedBg: s.surface.selected,
        itemSelectedColor: s.accent.primary,
      },
      Tag: {
        borderRadiusSM: parseInt(radius.sm),
      },
      Tooltip: {
        colorBgSpotlight: s.bg.raised,
      },
    },
  };
}
