import TaskList from "@/components/TaskList";

export function AllTasks() { return <TaskList title="All Tasks" subtitle="Everything in your workspace" />; }
export function Today() { return <TaskList scope="today" title="Today" subtitle="Focus on what's due today" />; }
export function Upcoming() { return <TaskList scope="upcoming" title="Upcoming" subtitle="Tasks scheduled for the future" />; }
export function Completed() { return <TaskList scope="completed" title="Completed" subtitle="Historical record — always searchable" />; }
