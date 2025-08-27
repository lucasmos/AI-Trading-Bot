# AMOLED Black Dark Mode Documentation

## Overview

The application now supports three theme modes:
1. **Light Mode** - Default light theme with a bright background
2. **Dark Mode** - Standard dark theme with dark blue/gray backgrounds
3. **AMOLED Black Mode** - True black (#000000) theme optimized for OLED screens

## Features

### Theme Toggle
- Located in the top navigation bar
- Cycles through themes in order: Light → Dark → AMOLED → Light
- Icons:
  - Light mode: Moon icon (☽)
  - Dark mode: Contrast icon (◐)
  - AMOLED mode: Sun icon (☀)

### AMOLED Black Theme Characteristics
- **True Black Background**: Uses #000000 for primary backgrounds
- **Enhanced Contrast**: Brighter text colors (98% lightness) for optimal readability
- **OLED Optimized**: Reduces power consumption on OLED displays
- **Accessibility Compliant**: Maintains WCAG AA contrast ratios (≥4.5:1 for normal text)

## Technical Implementation

### CSS Variables
The AMOLED theme is implemented using CSS custom properties defined in `src/app/globals.css`:

```css
.amoled {
  --background: 0 0% 0%;        /* True black #000000 */
  --foreground: 210 20% 98%;    /* Bright text for contrast */
  --card: 0 0% 0%;              /* Black card backgrounds */
  --primary: 174 50% 58%;       /* Brighter teal for visibility */
  /* ... additional variables */
}
```

### Theme Persistence
- Theme preference is saved in localStorage
- On page load, the saved preference is applied
- Falls back to system preference if no saved theme exists
- AMOLED mode is never auto-selected (must be manually chosen)

### Smooth Transitions
- Theme switching includes smooth color transitions (0.25s ease)
- Prevents jarring visual changes when switching themes

## Benefits

### For OLED Displays
- **Power Efficiency**: Black pixels are turned off on OLED screens, saving battery
- **Reduced Eye Strain**: True black reduces light emission in dark environments
- **No Color Smearing**: Optimized for OLED pixel response times

### For Users
- **Choice**: Three distinct visual modes to suit different preferences
- **Accessibility**: High contrast mode for improved readability
- **Consistency**: Theme applies across all components and pages

## Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support with OLED optimization

## Testing

### Manual Testing
1. Click the theme toggle button in the navigation
2. Verify cycling through all three modes
3. Refresh the page to confirm theme persistence
4. Test on OLED devices for power efficiency

### Automated Tests
Run the test suite:
```bash
npm test -- theme-toggle
```

Tests cover:
- Theme cycling order
- localStorage persistence
- Accessibility labels
- DOM class exclusivity
- System preference fallback

## Accessibility

### WCAG Compliance
- All text maintains ≥4.5:1 contrast ratio in AMOLED mode
- Focus rings remain visible on black backgrounds
- Proper ARIA labels for theme toggle states

### Keyboard Navigation
- Theme toggle is keyboard accessible
- Clear focus indicators in all theme modes

## Future Enhancements
- [ ] Add theme preview in settings
- [ ] Implement per-page theme overrides
- [ ] Add scheduling for automatic theme switching
- [ ] Include high contrast mode option
