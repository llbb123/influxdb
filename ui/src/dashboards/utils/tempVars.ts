import _ from 'lodash'

import {TEMPLATE_VARIABLE_QUERIES} from 'src/dashboards/constants'
import {
  Dashboard,
  Template,
  TemplateQuery,
  TemplateValue,
  URLQueries,
} from 'src/types'
import {TemplateUpdate} from 'src/types/tempVars'

interface PartialTemplateWithQuery {
  query: string
  tempVars: Array<Partial<Template>>
}

const generateTemplateVariableQuery = ({
  type,
  query: {
    database,
    // rp, TODO
    measurement,
    tagKey,
  },
}: Partial<Template>): PartialTemplateWithQuery => {
  const tempVars = []

  if (database) {
    tempVars.push({
      tempVar: ':database:',
      values: [
        {
          type: 'database',
          value: database,
        },
      ],
    })
  }
  if (measurement) {
    tempVars.push({
      tempVar: ':measurement:',
      values: [
        {
          type: 'measurement',
          value: measurement,
        },
      ],
    })
  }
  if (tagKey) {
    tempVars.push({
      tempVar: ':tagKey:',
      values: [
        {
          type: 'tagKey',
          value: tagKey,
        },
      ],
    })
  }

  const query: string = TEMPLATE_VARIABLE_QUERIES[type]

  return {
    query,
    tempVars,
  }
}

export const makeQueryForTemplate = ({
  influxql,
  db,
  measurement,
  tagKey,
}: TemplateQuery): string =>
  influxql
    .replace(':database:', `"${db}"`)
    .replace(':measurement:', `"${measurement}"`)
    .replace(':tagKey:', `"${tagKey}"`)

export const stripTempVar = (tempVarName: string): string =>
  tempVarName.substr(1, tempVarName.length - 2)

export const generateURLQueriesFromTempVars = (
  tempVars: Template[]
): URLQueries => {
  const urlQueries = {}

  tempVars.forEach(({tempVar, values}) => {
    const selected = values.find(value => value.selected === true)
    const strippedTempVar = stripTempVar(tempVar)

    urlQueries[strippedTempVar] = selected.value
  })

  return urlQueries
}

export const isValidTempVarOverride = (
  values: TemplateValue[],
  overrideValue: string
): boolean => !!values.find(({value}) => value === overrideValue)

const reconcileTempVarsWithOverrides = (
  currentTempVars: Template[],
  tempVarOverrides: URLQueries
): Template[] => {
  if (!tempVarOverrides) {
    return currentTempVars
  }
  const reconciledTempVars = currentTempVars.map(tempVar => {
    const {tempVar: name, values} = tempVar
    const strippedTempVar = stripTempVar(name)
    const overrideValue = tempVarOverrides[strippedTempVar]

    if (overrideValue) {
      const isValid = isValidTempVarOverride(values, overrideValue)

      if (isValid) {
        const overriddenValues = values.map(tempVarValue => {
          const {value} = tempVarValue
          if (value === overrideValue) {
            return {...tempVarValue, selected: true}
          }
          return {...tempVarValue, selected: false}
        })
        return {...tempVar, values: overriddenValues}
      }

      return tempVar
    }

    return tempVar
  })

  return reconciledTempVars
}

export const applyDashboardTempVarOverrides = (
  dashboard: Dashboard,
  tempVarOverrides: URLQueries
): Dashboard => ({
  ...dashboard,
  templates: reconcileTempVarsWithOverrides(
    dashboard.templates,
    tempVarOverrides
  ),
})

export const findUpdatedTempVarsInURLQuery = (
  tempVars: Template[],
  urlQueries: URLQueries
): TemplateUpdate[] => {
  const urlQueryTempVarsWithInvalidValues = _.reduce(
    urlQueries,
    (acc, v, k) => {
      const matchedTempVar = tempVars.find(
        ({tempVar}) => stripTempVar(tempVar) === k
      )
      if (matchedTempVar) {
        const isDifferentTempVarValue = !!matchedTempVar.values.find(
          ({value, selected}) => selected && value !== v
        )
        if (isDifferentTempVarValue) {
          acc.push({key: k, value: v})
        }
      }
      return acc
    },
    []
  )

  return urlQueryTempVarsWithInvalidValues
}

export const findInvalidTempVarsInURLQuery = (
  tempVars: Template[],
  urlQueries: URLQueries
): TemplateUpdate[] => {
  const urlQueryTempVarsWithInvalidValues = _.reduce(
    urlQueries,
    (acc, v, k) => {
      const matchedTempVar = tempVars.find(
        ({tempVar}) => stripTempVar(tempVar) === k
      )
      if (matchedTempVar) {
        const isValidTempVarValue = !!matchedTempVar.values.find(
          ({value}) => value === v
        )
        if (!isValidTempVarValue) {
          acc.push({key: k, value: v})
        }
      }
      return acc
    },
    []
  )

  return urlQueryTempVarsWithInvalidValues
}

export default generateTemplateVariableQuery
