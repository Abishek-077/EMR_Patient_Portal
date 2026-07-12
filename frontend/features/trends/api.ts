import {
  addTrendGoal,
  addTrendReading,
  deleteTrendGoal,
  deleteTrendReading,
  getTrendsExport,
  updateTrendGoal,
  updateTrendReading,
} from '../../shared/api/api';

export const trendsApi = {
  getTrendsExport,
  addTrendReading,
  updateTrendReading,
  deleteTrendReading,
  addTrendGoal,
  updateTrendGoal,
  deleteTrendGoal,
};
