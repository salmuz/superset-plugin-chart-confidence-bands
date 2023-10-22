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
  Refs,
  getPadding,
  getLegendProps,
  TimeseriesDefaultFormData as DEFAULT_FORM_DATA,
} from '@superset-ui/plugin-chart-echarts';
import {
  DataRecord,
  getXAxisLabel,
  SqlaFormData,
  t,
  TimeseriesChartDataResponseResult,
} from '@superset-ui/core';
import {
  SupersetPluginChartConfidenceBandsQueryFormData,
  SupersetPluginChartConfidenceBandsProps,
} from '../types';
import { convertInteger } from './helpers';

export const defaultGrid = {
  containLabel: true,
};

export const TIMESERIES_CONSTANTS = {
  gridOffsetRight: 20,
  gridOffsetLeft: 20,
  gridOffsetTop: 20,
  gridOffsetBottom: 20,
  gridOffsetBottomZoomable: 80,
  legendRightTopOffset: 30,
  legendTopRightOffset: 55,
  zoomBottom: 30,
  toolboxTop: 0,
  toolboxRight: 5,
  dataZoomStart: 0,
  dataZoomEnd: 100,
  yAxisLabelTopOffset: 20,
  extraControlsOffset: 22,
};

type BandConfidenceOptions = {
  name: string;
  groupBy: string;
  opacityLower: number;
  opacityUpper: number;
  labels: Array<string>;
};
const DEFAULT_METRIC_COLOR = '#FFFFFF';
const DEFAULT_PREDICTION_COLOR = '#2C3227';
const DEFAULT_PREDICTION_LINE_STYLE = {
  lineStyle: {
    normal: {
      color: DEFAULT_PREDICTION_COLOR,
      width: 1.5,
      type: 'dashed',
    },
  },
};

function extractLabelsByBands(formData: SqlaFormData) {
  const labelsByBands: Array<BandConfidenceOptions> = [];
  const bandConfidence = [
    {
      name: 'Bound L1 (95%)',
      groupBy: 'bandConfidenceL1',
      opacity: 0.05,
      band: formData?.bandConfidenceL1 || [],
    },
    {
      name: 'Bound L2 (85%)',
      groupBy: 'bandConfidenceL2',
      opacity: 0.07,
      band: formData?.bandConfidenceL2 || [],
    },
    {
      name: 'Bound L3 (75%)',
      groupBy: 'bandConfidenceL3',
      opacity: 0.1,
      band: formData?.bandConfidenceL3 || [],
    },
    {
      name: 'Bound L4 (65%)',
      groupBy: 'bandConfidenceL4',
      opacity: 0.2,
      band: formData?.bandConfidenceL4 || [],
    },
  ];
  bandConfidence.forEach(bandConfidence => {
    if (bandConfidence.band?.length > 1) {
      labelsByBands.push({
        name: bandConfidence.name,
        groupBy: bandConfidence.groupBy,
        opacityLower: bandConfidence.opacity,
        opacityUpper: bandConfidence.opacity,
        labels: bandConfidence.band.map((x: { label: any }) => x?.label),
      });
    }
  });
  return labelsByBands;
}

function builderEchartsLineSeries(
  name: string,
  itemStyle: any,
  opacityLine = 0.0,
) {
  return {
    name,
    type: 'line',
    lineStyle: {
      opacity: opacityLine,
    },
    itemStyle,
  };
}

function builderEchartsConfidenceBandSeries(
  data: { name: string; series: Array<any> },
  itemStyle: any,
  band: any,
  stackStrategy: string | undefined,
  colorBand = '#ff0000',
) {
  const item = {
    ...builderEchartsLineSeries(data.name, itemStyle),
    stackStrategy,
    stack: band.groupBy,
  };
  return [
    {
      ...item,
      areaStyle: {
        color: colorBand,
        opacity: band.opacityLower,
      },
      data: data.series.map(x => [0, 1].map(i => x[i])),
    },
    {
      ...item,
      areaStyle: {
        color: colorBand,
        opacity: band.opacityUpper,
      },
      data: data.series.map(x => [0, 2].map(i => x[i])),
    },
  ];
}

function extractConfidenceBandsSeries(
  data: DataRecord[],
  xAxis: string,
  bandConfidence: Array<any>,
  itemStyle: any,
  metrics: Array<any>,
  label_map: any,
) {
  const finalSeries: Array<any> = [];
  bandConfidence.forEach((band: BandConfidenceOptions) => {
    let isFullNegative = true;
    let isFullPositive = true;
    let bounds: Array<Array<number>> = data.map(
      (serie: { [x: string]: any }) => {
        const xAxisValue = serie[xAxis];
        const bandValue = band.labels.map((label: string) => serie[label]);
        bandValue.sort();
        if (bandValue[0] > 0) isFullNegative = false;
        if (bandValue[0] < 0) isFullPositive = false;
        return [xAxisValue, ...bandValue];
      },
    );
    // Logic to create confidence band correctly
    /*
       If bounds of a level are:
       Lower bound    |  Upper bound     |   Strategy
       ===========================================================
       Full negative  | Full positive    |  samesign (opacity > 0)
       -----------------------------------------------------------
       Full positive  | Full positive    |  positive (OpacityLower = 0.0)
                      |                  |  upper_bound = upper_bound - lower_bound
        -----------------------------------------------------------
       Mixed values   | Full positive    |  all (OpacityLower = 0.0)
                      |                  |  upper_bound = upper_bound - lower_bound
        -----------------------------------------------------------
        All other cases is not possible, since Upper bound is always greater
        than Lower bound
     */
    let stackStrategy;
    if (isFullNegative) stackStrategy = 'samesign';
    if (isFullPositive) {
      stackStrategy = 'positive';
      // eslint-disable-next-line no-param-reassign
      band.opacityLower = 0.0;
      bounds = bounds.map(x => [x[0], x[1], x[2] - x[1]]);
    }
    if (!isFullNegative && !isFullPositive) {
      // eslint-disable-next-line no-param-reassign
      band.opacityLower = 0.0;
      stackStrategy = 'all';
      bounds = bounds.map(x => [x[0], x[1], x[2] - x[1]]);
    }
    finalSeries.push(
      builderEchartsConfidenceBandSeries(
        {
          name: band.name,
          series: bounds,
        },
        itemStyle,
        band,
        stackStrategy,
      ),
    );
  });
  metrics.forEach((metric: { label: string }) => {
    const series = data.map((serie: { [x: string]: any }) => [
      serie[xAxis],
      serie[metric.label],
    ]);
    finalSeries.push([
      {
        ...builderEchartsLineSeries(
          label_map[metric.label][0] || metric.label,
          // eslint-disable-next-line theme-colors/no-literal-colors
          {
            color:
              metric.label.toLowerCase() === 'prediction'
                ? DEFAULT_PREDICTION_COLOR
                : DEFAULT_METRIC_COLOR, // To-Do use superset categorical colors
          },
          1.0,
        ),
        data: series,
        ...(metric.label.toLowerCase() === 'prediction'
          ? DEFAULT_PREDICTION_LINE_STYLE
          : {}),
      },
    ]);
  });
  return finalSeries;
}

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
  const {
    width,
    height,
    hooks,
    filterState,
    formData,
    theme,
    legendState,
    emitCrossFilters,
    queriesData,
  } = chartProps;
  const {
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
  const itemStyleAll = {
    // eslint-disable-next-line theme-colors/no-literal-colors
    color: '#ff0000',
    opacity: 0.6,
  };
  const [queryData] = queriesData;
  const { data = [], label_map = {} } =
    queryData as TimeseriesChartDataResponseResult;
  const bandConfidence = extractLabelsByBands(formData);
  const xAxis = getXAxisLabel(chartProps.rawFormData) as string;
  const dataSeries = extractConfidenceBandsSeries(
    data,
    xAxis,
    bandConfidence,
    itemStyleAll,
    metrics,
    label_map,
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
      trigger: 'axis',
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
    refs,
  };
}
