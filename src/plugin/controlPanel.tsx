/**
 * Licensed to the Apache Software Foundation (ASF)
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * There are several predefined controls that can be used.
 * Some examples:
 * - groupby: columns to group by (translated to GROUP BY statement)
 * - series: same as groupby, but single selection.
 * - metrics: multiple metrics (translated to aggregate expression)
 * - metric: sane as metrics, but single selection
 * - adhoc_filters: filters (translated to WHERE or HAVING
 *   depending on filter type)
 * - row_limit: maximum number of rows (translated to LIMIT statement)
 *
 * If a control panel has both a `series` and `groupby` control, and
 * the user has chosen `col1` as the value for the `series` control,
 * and `col2` and `col3` as values for the `groupby` control,
 * the resulting query will contain three `groupby` columns. This is because
 * we considered `series` control a `groupby` query field and its value
 * will automatically append the `groupby` field when the query is generated.
 *
 * It is also possible to define custom controls by importing the
 * necessary dependencies and overriding the default parameters, which
 * can then be placed in the `controlSetRows` section
 * of the `Query` section instead of a predefined control.
 *
 * import { validateNonEmpty } from '@superset-ui/core';
 * import {
 *   sharedControls,
 *   ControlConfig,
 *   ControlPanelConfig,
 * } from '@superset-ui/chart-controls';
 *
 * const myControl: ControlConfig<'SelectControl'> = {
 *   name: 'secondary_entity',
 *   config: {
 *     ...sharedControls.entity,
 *     type: 'SelectControl',
 *     label: t('Secondary Entity'),
 *     mapStateToProps: state => ({
 *       sharedControls.columnChoices(state.datasource)
 *       .columns.filter(c => c.groupby)
 *     })
 *     validators: [validateNonEmpty],
 *   },
 * }
 *
 * In addition to the basic drop down control, there are several predefined
 * control types (can be set via the `type` property) that can be used. Some
 * commonly used examples:
 * - SelectControl: Dropdown to select single or multiple values,
     usually columns
 * - MetricsControl: Dropdown to select metrics, triggering a modal
     to define Metric details
 * - AdhocFilterControl: Control to choose filters
 * - CheckboxControl: A checkbox for choosing true/false values
 * - SliderControl: A slider with min/max values
 * - TextControl: Control for text data
 *
 * For more control input types, check out the `incubator-superset` repo
 * and open this file: superset-frontend/src/explore/components/controls/index.js
 *
 * To ensure all controls have been filled out correctly, the following
 * validators are provided
 * by the `@superset-ui/core/lib/validator`:
 * - validateNonEmpty: must have at least one value
 * - validateInteger: must be an integer value
 * - validateNumber: must be an integer or decimal value
 */

import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlSetRow,
  ControlSubSectionHeader,
  getStandardizedControls,
  sharedControls,
  xAxisSortSeriesControl,
} from '@superset-ui/chart-controls';
import React from 'react';
import {
  legendSection,
  richTooltipSection,
  showValueControl,
  TimeseriesDefaultFormData as DEFAULT_FORM_DATA,
} from '@superset-ui/plugin-chart-echarts';

function createControlQueryBand(bandSuffix: string): ControlSetRow {
  return [
    {
      name: `band_confidence_l${bandSuffix}`,
      config: {
        ...sharedControls.metrics,
        label: `Band Confidence L${bandSuffix}`,
        validators: [],
        description: `Lower and Upper bounds for the confidence band L${bandSuffix}`,
      },
    },
  ];
}

const { markerEnabled, markerSize, rowLimit, zoomable } = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['x_axis'],
        [xAxisSortSeriesControl],
        [
          {
            name: 'y_prediction_hat',
            config: {
              ...sharedControls.metric,
              label: t('Prediction'),
              description: t('Prediction value'),
            },
          },
        ],
        ['metrics'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Band Confidence Levels'),
      expanded: true,
      controlSetRows: [
        createControlQueryBand('1'),
        createControlQueryBand('2'),
        createControlQueryBand('3'),
        createControlQueryBand('4'),
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [<ControlSubSectionHeader>{t('Series Opt.')}</ControlSubSectionHeader>],
        [showValueControl],
        [
          {
            name: 'markerEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Marker'),
              renderTrigger: true,
              default: markerEnabled,
              description: t(
                'Draw a marker on data points. Only applicable for line types.',
              ),
            },
          },
        ],
        [
          {
            name: 'markerSize',
            config: {
              type: 'SliderControl',
              label: t('Marker Size'),
              renderTrigger: true,
              min: 0,
              max: 20,
              default: markerSize,
              description: t(
                'Size of marker. Also applies to forecast observations.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.markerEnabled?.value),
            },
          },
        ],
        [
          {
            name: 'zoomable',
            config: {
              type: 'CheckboxControl',
              label: t('Data Zoom'),
              default: zoomable,
              renderTrigger: true,
              description: t('Enable data zooming controls'),
            },
          },
        ],
        ...legendSection,
        ...richTooltipSection,
      ],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
