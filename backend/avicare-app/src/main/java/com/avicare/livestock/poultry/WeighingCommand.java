package com.avicare.livestock.poultry;

import java.time.LocalDate;
import java.util.List;

/** Command to record a sample weighing: the date and the individual gram weights. */
public record WeighingCommand(
    LocalDate sampleDate, List<Integer> individualWeights, String notes) {}
