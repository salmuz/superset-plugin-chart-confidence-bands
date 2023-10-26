# superset-plugin-chart-confidence-bands

This is the Superset Plugin Chart to display confidence bands of a 
regression prediction problem.

## Usage

To use the plugin, it needs to clone/copy the folder in `superset-frontend/plugins` 
folder of your Superset installation. After that, you need to do some modifications



*We're working hard to finish the development of this readme*


## Integration with Superset Project

After this edit the `superset-frontend/src/visualizations/presets/MainPreset.js` and make the following changes:

```js
import { SupersetPluginChartConfidenceBands } from 'superset-plugin-chart-confidence-bands';
```

to import the plugin and later add the following to the array that's passed to the `plugins` property:
```js
new SupersetPluginChartConfidenceBands().configure({ key: 'superset-plugin-chart-confidence-bands' }),
```

After that the plugin should show up when you run Superset, e.g. the development server:

```
npm run dev-server
```
