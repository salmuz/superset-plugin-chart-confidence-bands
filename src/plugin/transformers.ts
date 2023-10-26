import {
  CategoricalColorScale,
  DataRecord,
  SqlaFormData,
} from '@superset-ui/core';
import { BandConfidenceOptions } from './types';
import {
  DEFAULT_METRIC_COLOR,
  DEFAULT_PREDICTION_COLOR,
  DEFAULT_PREDICTION_LINE_STYLE,
} from './constants';

export function extractLabelsByBands(
  formData: SqlaFormData,
  legendBands: Array<string>,
) {
  const labelsByBands: Array<BandConfidenceOptions> = [];
  const bandConfidence = [
    {
      name: legendBands[0] || 'Bound L1 (95%)',
      groupBy: 'bandConfidenceL1',
      opacity: 0.05,
      band: formData?.bandConfidenceL1 || [],
    },
    {
      name: legendBands[1] || 'Bound L2 (85%)',
      groupBy: 'bandConfidenceL2',
      opacity: 0.07,
      band: formData?.bandConfidenceL2 || [],
    },
    {
      name: legendBands[2] || 'Bound L3 (75%)',
      groupBy: 'bandConfidenceL3',
      opacity: 0.1,
      band: formData?.bandConfidenceL3 || [],
    },
    {
      name: legendBands[3] || 'Bound L4 (65%)',
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
    // show values in mouseover
    // silent: true,
    // emphasis: {
    //   label: {
    //     show: true,
    //   },
    // },
    itemStyle,
  };
}

function builderEchartsConfidenceBandSeries(
  data: { name: string; series: Array<any> },
  backgroundStyleBands: any,
  band: any,
  stackStrategy: string | undefined,
  colorBand = '#ff0000',
) {
  const item = {
    ...builderEchartsLineSeries(data.name, backgroundStyleBands),
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

export function extractConfidenceBandsSeries(
  data: DataRecord[],
  xAxis: string,
  bandConfidence: Array<any>,
  backgroundStyleBands: any,
  prediction_metric: any,
  metrics: Array<any>,
  label_map: any,
  colorScale: CategoricalColorScale,
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
        backgroundStyleBands,
        band,
        stackStrategy,
      ),
    );
  });
  // add Prediction metric line + all the other metrics lines
  const PREDICTION_METRIC_INDEX = 0;
  [prediction_metric, ...metrics].forEach(
    (metric: { label: string }, index: number) => {
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
                PREDICTION_METRIC_INDEX === index
                  ? DEFAULT_PREDICTION_COLOR
                  : colorScale.getColor(metric.label) || DEFAULT_METRIC_COLOR,
            },
            1.0,
          ),
          data: series,
          ...(PREDICTION_METRIC_INDEX === index
            ? DEFAULT_PREDICTION_LINE_STYLE
            : {}),
        },
      ]);
    },
  );
  return finalSeries;
}
