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
import {
  buildQueryContext,
  ensureIsArray,
  getXAxisColumn,
  isXAxisSet,
  QueryFormData,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const { groupby } = formData;
  const extra_metrics = [
    ...formData?.band_confidence_l1,
    ...formData?.band_confidence_l2,
    ...formData?.band_confidence_l3,
    ...formData?.band_confidence_l4,
  ];

  const columns = [
    ...(isXAxisSet(formData) ? ensureIsArray(getXAxisColumn(formData)) : []),
    ...ensureIsArray(groupby),
  ];

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      metrics: [...(baseQueryObject.metrics || []), ...extra_metrics],
      columns,
      series_columns: groupby,
      ...(isXAxisSet(formData) ? {} : { is_timeseries: true }),
      // ...(sort_by_metric && { orderby: [[metric, false]] }),
    },
  ]);
}
