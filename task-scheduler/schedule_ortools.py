import collections
from ortools.sat.python import cp_model
import pandas as pd
import math

def invert_bit(bit):
    return 1 - bit

task_type = collections.namedtuple('task_type', 'id start end is_present interval raw_priority opt_raw_priority priority opt_priority delay is_late')
assigned_task_type = collections.namedtuple('assigned_task_type', 'start task duration priority delay is_present is_late')
reserved_tag_interval = collections.namedtuple('reserved_tag_interval', 'interval tags')

def schedule(tasks, reserved_intervals, reserved_tags, start):
    if not len(tasks):
        return {
            "found": True,
            "tasks": []
        }
    
    # cast dates to int64
    tasks['maxDueDate'] = tasks['maxDueDate'].astype('Int64')
    tasks['dueDate'] = tasks['dueDate'].astype('Int64')
    durations = list(tasks["duration"])
    impacts = list(tasks["impact"].fillna(0))
    dueDates = list(tasks['dueDate'])
    maxDueDates = list(tasks['maxDueDate'])
    tags = list(tasks['tags'])

    # Horizon is the greatest due date
    horizon = tasks['maxDueDate'].max()
    # Max raw priority is the greatest impact*100/duration
    max_raw_priority = math.floor(max([impact*100/durations[task_id] for task_id, impact in enumerate(impacts)]))
    # Set maximum delay in %
    max_delay = 10000

    # Create the model.
    model = cp_model.CpModel()

    all_tasks = {}

    # Create vars for all reserved tag intervals
    reserved_tag_intervals = []
    for index, row in reserved_tags.iterrows():
        reserved_tag_intervals.append(reserved_tag_interval(
                tags= row['tags'],
                interval=model.NewIntervalVar(row['start'], row['end'] - row['start'], row['end'], f'reserved_tag_interval_{index}')
            )
        )

    # Create vars for all reserved event intervals
    reserved_event_intervals = []
    for index, row in reserved_intervals.iterrows():
        reserved_event_intervals.append(model.NewIntervalVar(row['start'], row['end'] - row['start'], row['end'], f'reserved_event_interval_{index}'))

    # Create vars for all tasks
    for task_id, duration in enumerate(list(durations)):
        suffix = '_%i' % (task_id)
        # Task starts between start and horizon
        start_var = model.NewIntVar(start, horizon - duration, 'start' + suffix)
        # Task ends between start and horizon
        end_var = model.NewIntVar(start, horizon, 'end' + suffix)
        # Task can be present or not
        is_present_var = model.NewBoolVar('is_present' + suffix)
        # Task can be late or on time
        is_late_var = model.NewBoolVar('is_late' + suffix)
        # Task is modelized by an interval
        interval_var = model.NewOptionalIntervalVar(start_var, duration, end_var, is_present_var, 'interval' + suffix)
        if pd.notna(maxDueDates[task_id]) and maxDueDates[task_id] != dueDates[task_id]:
            # Create delay var
            delay_var = model.NewIntVar(-100, max_delay, 'delay' + suffix)
            model.AddDivisionEquality(delay_var, (dueDates[task_id] - end_var)*100, maxDueDates[task_id] - dueDates[task_id])
            # Delay is negative if task is late
            model.Add(delay_var < 0).OnlyEnforceIf(is_late_var) # delete ?
            # Delay is positive if task is on time
            model.Add(delay_var >= 0).OnlyEnforceIf(is_late_var.Not()) # delete ?
        else:
            # Create 0 delay var if due date is max due date
            delay_var = model.NewConstant(0)
        # Task initial priority is impact per duration
        raw_priority = math.floor(impacts[task_id]*100/duration)
        # Initial priority should be 0 if event is not present
        opt_raw_priority_var = model.NewIntVar(0, max_raw_priority, 'raw_priority' + suffix)
        model.AddMultiplicationEquality(opt_raw_priority_var, [raw_priority, is_present_var])
        # Final priority is initial priority x delay
        priority_var = model.NewIntVar(-max_raw_priority * 100, max_raw_priority * max_delay, 'priority' + suffix)
        model.AddMultiplicationEquality(priority_var, [raw_priority, delay_var]) # , is_present_var ?
        # Priority should be 0 if event is not present
        opt_priority_var = model.NewIntVar(-max_raw_priority * 100, max_raw_priority * max_delay, 'opt_priority' + suffix)
        model.AddMultiplicationEquality(opt_priority_var, [priority_var, is_present_var])
        # Prevent reserved intervals from overlapping
        incompatible_intervals = []
        for reserved_interval in reserved_tag_intervals:
            if not(len([value for value in reserved_interval.tags if value in tags[task_id]])):
                incompatible_intervals.append(reserved_interval.interval)
        for reserved_interval in reserved_event_intervals:
            incompatible_intervals.append(reserved_interval)
        model.AddNoOverlap(incompatible_intervals + [interval_var])
        # Add task vars to all_tasks
        all_tasks[task_id] = task_type(
            id=tasks.iloc[task_id]['id'],
            start=start_var,
            end=end_var,
            interval=interval_var,
            is_present=is_present_var,
            raw_priority=raw_priority,
            opt_raw_priority=opt_raw_priority_var,
            priority=priority_var,
            opt_priority=opt_priority_var,
            delay=delay_var,
            is_late=is_late_var
        )
    
    # Prevent all tasks from overlapping
    model.AddNoOverlap([all_tasks[task].interval for task in all_tasks])

    # Maximize raw priority
    total_raw_priority_var = model.NewIntVar(0, sum([all_tasks[task_id].raw_priority for task_id in all_tasks]), name='total_raw_priority')
    model.Add(total_raw_priority_var == sum([all_tasks[task_id].opt_raw_priority for task_id in all_tasks]))
    model.Maximize(total_raw_priority_var)

    # Creates the solver and solve.
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        # Hint (speed up solving)
        for k, v in all_tasks.items():
            model.Add(v.is_present == solver.Value(v.is_present))

        # Maximize priority (and constraint previous objective)
        model.Add(total_raw_priority_var == round(solver.ObjectiveValue()))  # use <= or >= if not optimal
        total_priority_var = model.NewIntVar(
            -sum([all_tasks[task_id].raw_priority * 100 for task_id in all_tasks]),
            sum([all_tasks[task_id].raw_priority * max_delay for task_id in all_tasks]),
            name='total_priority'
        )
        model.Add(total_priority_var == sum([all_tasks[task_id].opt_priority for task_id in all_tasks]))
        model.Maximize(total_priority_var)

        solver.Solve(model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f'Optimal Priority: {solver.ObjectiveValue()}')
            for task_id, duration in enumerate(list(durations)):
                print(assigned_task_type(
                    start=solver.Value(all_tasks[task_id].start),
                    task=task_id,
                    duration=duration,
                    priority=solver.Value(all_tasks[task_id].priority),
                    is_present=solver.Value(all_tasks[task_id].is_present),
                    delay=solver.Value(all_tasks[task_id].delay),
                    is_late=solver.Value(all_tasks[task_id].is_late)
                ))
            return {
                "found": True,
                "tasks": {
                    v.id: {
                        "start": solver.Value(v.start),
                        "isLate": bool(solver.Value(v.is_late)),
                        "isPresent": bool(solver.Value(v.is_present)),
                        "duration": int(duration),
                        "priority": solver.Value(v.priority),
                        "delay": solver.Value(v.delay)
                    } for k, v in all_tasks.items()
                }
            }
        else:
            print('No solution found (stage 2)')
            return {
                "found": False,
                "tasks": []
            }
    else:
        print('No solution found (stage 1)')
        return {
            "found": False,
            "tasks": []
        }
