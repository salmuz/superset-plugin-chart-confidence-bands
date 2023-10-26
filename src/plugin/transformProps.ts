/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { EChartsCoreOption } from 'echarts';
import {
  EchartsTimeseriesFormData,
  getDefaultTooltip,
  getLegendProps,
  getPadding,
  Refs,
  TimeseriesDefaultFormData as DEFAULT_FORM_DATA,
} from '@superset-ui/plugin-chart-echarts';
import {
  CategoricalColorNamespace,
  getXAxisLabel,
  t,
  TimeseriesChartDataResponseResult,
} from '@superset-ui/core';
import {
  SupersetPluginChartConfidenceBandsProps,
  SupersetPluginChartConfidenceBandsQueryFormData,
} from '../types';
import { convertInteger } from './helpers';
import {
  TIMESERIES_CONSTANTS,
  DEFAULT_BACKGROUND_STYLE_BANDS,
} from './constants';
import {
  extractConfidenceBandsSeries,
  extractLabelsByBands,
} from './transformers';

export const defaultGrid = {
  containLabel: true,
};

export default function transformProps(
  chartProps: SupersetPluginChartConfidenceBandsQueryFormData,
): SupersetPluginChartConfidenceBandsProps {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your SupersetPluginChartConfidenceBands.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  let focusedSeries: string | null = null;
  const {
    width,
    height,
    hooks,
    filterState,
    rawFormData,
    formData,
    theme,
    inContextMenu,
    legendState,
    emitCrossFilters,
    queriesData,
  } = chartProps;
  const {
    colorScheme,
    richTooltip,
    legendBandConfidenceL1,
    legendBandConfidenceL2,
    legendBandConfidenceL3,
    legendBandConfidenceL4,
    metrics,
    xAxisTitle,
    yAxisTitle,
    showLegend,
    legendType,
    legendOrientation,
    legendMargin,
    groupby,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    zoomable,
  }: EchartsTimeseriesFormData = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };
  const { setDataMask = () => {} } = hooks;
  const refs: Refs = {};
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const [queryData] = queriesData;
  const { data = [], label_map = {} } =
    queryData as TimeseriesChartDataResponseResult;
  const isEmpty = (input: string) => (input?.trim()?.length || 0) === 0;
  const bandConfidence = extractLabelsByBands(formData, [
    isEmpty(legendBandConfidenceL1?.trim())
      ? undefined
      : legendBandConfidenceL1?.trim(),
    isEmpty(legendBandConfidenceL2?.trim())
      ? undefined
      : legendBandConfidenceL2?.trim(),
    isEmpty(legendBandConfidenceL3?.trim())
      ? undefined
      : legendBandConfidenceL3?.trim(),
    isEmpty(legendBandConfidenceL4?.trim())
      ? undefined
      : legendBandConfidenceL4?.trim(),
  ]);
  const xAxis = getXAxisLabel(chartProps.rawFormData) as string;
  const dataSeries = extractConfidenceBandsSeries(
    data,
    xAxis,
    bandConfidence,
    DEFAULT_BACKGROUND_STYLE_BANDS,
    rawFormData?.y_prediction_hat,
    metrics,
    label_map,
    colorScale,
  );

  const addYAxisLabelOffset = !!yAxisTitle;
  const addXAxisLabelOffset = !!xAxisTitle;
  const padding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisLabelOffset,
    zoomable,
    legendMargin,
    addXAxisLabelOffset,
    yAxisTitlePosition,
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
      ...padding,
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
      ),
      // data: legendData as string[],
    },
    xAxis: {
      type: 'category',
    },
    yAxis: {
      type: 'value',
    },
    series: dataSeries.reduce((acc, x) => [...acc, ...x]),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
          },
        },
      },
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: richTooltip ? 'axis' : 'item',
      axisPointer: {
        type: 'cross',
        label: {
          // eslint-disable-next-line theme-colors/no-literal-colors
          backgroundColor: '#ccc',
          // eslint-disable-next-line theme-colors/no-literal-colors
          borderColor: '#aaa',
          // eslint-disable-next-line theme-colors/no-literal-colors
          color: '#222',
        },
      },
      formatter(params: any[]) {
        const aggValues = params.reduce(
          (accumulator, current: { seriesName: string; data: any[] }) => {
            const { seriesName } = current;
            if (!accumulator[seriesName]) {
              accumulator[seriesName] = { seriesName, values: [] };
            }
            accumulator[seriesName].values.push(current.data[1]);
            return accumulator;
          },
          {},
        );
        const rows: string[] = [];
        Object.keys(aggValues).forEach(key => {
          const value = aggValues[key];
          let content = `${value?.seriesName} `;
          content += `(${value?.values.join(' ; ')})`;
          const contentStyle =
            key === focusedSeries ? 'font-weight: 700' : 'opacity: 0.7';
          rows.push(`<span style="${contentStyle}">${content}</span>`);
        });
        return rows.join('<br />');
      },
    },
    dataZoom: zoomable
      ? [
          {
            type: 'slider',
            start: TIMESERIES_CONSTANTS.dataZoomStart,
            end: TIMESERIES_CONSTANTS.dataZoomEnd,
            bottom: TIMESERIES_CONSTANTS.zoomBottom,
          },
        ]
      : [],
  };

  const columnsLabelMap = new Map<string, string[]>();
  const onFocusedSeries = (seriesName: string | null) => {
    console.log('---> onFocusedSeries', seriesName);
    focusedSeries = seriesName;
  };

  return {
    echartOptions,
    emitCrossFilters,
    formData,
    groupby,
    setDataMask,
    labelMap: Object.fromEntries(columnsLabelMap),
    selectedValues: filterState.selectedValues || [],
    height,
    width,
    onFocusedSeries,
    refs,
  };
}
