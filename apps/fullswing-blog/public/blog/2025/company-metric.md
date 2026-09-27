During my 20+ years of being a software developer, I've encountered only one company that was doing most things right. This made the company very successful but also lended itself to my own success. I was promoted twice in 4 years. It felt like I had more growth in that 4 years than the other 16 years of my career combined.

I'm at a stage now, where if I find a new job, it must be similar to that company. I cannot afford to work full-time hours and study 10+ hours a week to stay relevant because I'm not learning at my current position. Most companies grind you so hard you don't have time to tackle technical debt, 100% of deadlines are missed because they are either superimposed or unrealistic. I've even been in positions where I was hired as a senior and forced to work at a junior level. I often find myself asking: why are you even interviewing for advanced developer skills if you don't give them time or space to use them e.g. TDD, DDD, design patterns, etc.

If you don't trust your subject experts, you need to somehow convey the effect that short-term focused goals has on long-term efficiency. This is not an easy task, metrics that are visible to management and stakeholders is one way. It will help to include a micromanagement category metric to offset metric abuse e.g "hours of meetings per month for software developers". I also recommend a metric on employee retention, add some relevant questions on exit interviews e.g. "did you feel there were areas the company could approve?"

This leads to an important metric I wanted to come up with to evaluate companies during the interview process to determine if they are a company with long-term maintainability efficieny:

- How much can developers influence the sprint? Ideally the developers would add 10-20% of technical debt to each sprint by adding tasks and/or with strong code reviews. This commitment will increase long term velocity by at least 2-3 times, see [my post](/blog/develop-cost). To get a feeling what your current weight is, pick a few distinct features and ask a developer: how much time would it take to fix feature X now and after the code was refactored?
- How often do you practice TDD? This will help minimize the impact of refactoring
- Do you have sprint retrospectives? Do you action on the feedback?
- What is your [Joel test score](https://www.joelonsoftware.com/2000/08/09/the-joel-test-12-steps-to-better-code/)?
- Are you paying above average salaries? This is an indicator of efficiency and helps retain higher quality employees
- Do stakeholders and management have visibility to metrics that measure long term efficiency? See above for examples
- Is technical debt included in your estimates? At the bare minimum, you should be eliminating as much technical debt as you are adding

Quote from the book "The Clean Architect by Robert C. Martin":

> When software is done right, it requires a fraction of the human resources to
> create and maintain. Changes are simple and rapid. Defects are few and far
> between. Effort is minimized, and functionality and flexibility are maximized.
> Yes, this vision sounds a bit utopian. But I’ve been there; I’ve seen it happen.
> I’ve worked in projects where the design and architecture of the system made
> it easy to write and easy to maintain. I’ve experienced projects that required a
> fraction of the anticipated human resources. I’ve worked on systems that had
> extremely low defect rates. I’ve seen the extraordinary effect that good
> software architecture can have on a system, a project, and a team. I’ve been to
> the promised land."
