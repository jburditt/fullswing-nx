I was originally going to write my project "Gamify Workout" by hand the old school way, like a chump. But at some point I realized it was a great candidate for an AI learning and experimental project. The project had two pages implemented, so the first step was to generate spec documents from AI to want resemble spec documents that AI would use to generate the pages. The goal is "Vibe Coding" as much as possible, to least as much AI as possible. I don't necessarily believe "Vibe Coding" is the most efficient direction for writing code but I do believe it is the most efficient method for my own learning goals.

AI Prompt:
> Analyze the current code for projects/gamifyworkout and create spec files that AI would understand and be able to build those files. I will use these spec files as a template for adding future specs that AI can use to generate code for new features.

Because I'm on a free edition of Github copilot, the above spanned two days. It created spec documents in a folder `SPECS`. I also added the following:

## Angular
Add `.vscode/mcp.json`
```json
{
  "servers": {
    "angular-cli": {
      "command": "npx",
      "args": ["-y", "@angular/cli", "mcp"]
    }
  }
}
```

Add `.github/instructions/unit-test.md.instructions`
```markdown
# AI Instructions: Angular Unit Testing Best Practices

Act as an expert Angular Engineer. When generating unit tests, follow these strict guidelines to ensure maintainable, fast, and modern test suites.

## 1. Technical Stack & Environment
- **Framework:** Angular 21.
- **Test Runner:** Use Vitest. Avoid Karma/Jasmine unless explicitly requested.
- **Library:** Use `TestBed` for integration; use `ng-mocks` for mocking dependencies.
- **Control Flow:** Use modern `@if`, `@for`, and `@switch` syntax in templates.

## 2. Test Structure (AAA Pattern)
Every `it` block must follow the Arrange-Act-Assert pattern:
- **Arrange:** Set up mocks, spies, and component state.
- **Act:** Execute the method or trigger the UI event.
- **Assert:** Verify the outcome (expectations).

## 3. Component Testing Rules
- **Standalone:** Assume components are `standalone: true`.
- **Change Detection:** Use `fixture.detectChanges()` manually. For `OnPush` components, use `fixture.checkNoChanges()` where applicable.
- **Signals:** Use `component.mySignal.set(value)` and verify results using `expect(component.myComputed())`.
- **DOM Queries:** Prefer `data-testid` selectors over CSS classes or element tags.
  - *Good:* `fixture.debugElement.query(By.css('[data-testid="login-btn"]'))`

## 4. Service & Mocking Strategy
- **Isolation:** Test services in isolation by instantiating them with mocked dependencies rather than full `TestBed` where possible.
- **HTTP:** Use `HttpTestingController` to verify API calls.
- **Dependencies:** Always mock child components and services using `MockBuilder` or `MockProvider` from `ng-mocks` to avoid "Deep Testing."

## 5. Modern Angular Patterns
- **Inject Function:** Use `TestBed.inject(MyService)` instead of the old constructor-based injection in tests.
- **Observables:** Use `firstValueFrom` or `subscribe` with `done()` to test asynchronous streams.
- **Input/Output:** Use the new `input()` and `output()` signal-based APIs.
  - Trigger outputs: `component.myOutput.emit(value)`.

## 6. Naming Conventions
- **Describe Blocks:** Use the format `describe('ClassName / MethodName', () => { ... })`.
- **It Blocks:** Use human-readable requirements: `it('should redirect the user when login is successful', () => { ... })`.

## 7. Constraints
- **No Legacy:** Never use `var`, `promises` (where Observables are expected), or `ngIf/ngFor`.
- **Coverage:** Aim for logic coverage (edge cases, error handling), not just "happy paths."
- **Mock Data:** Create small, reusable `const` mock objects instead of giant inline objects.

## 8. Example Test Case
```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest'; // Import from vitest
import { User } from './user';

describe('User Component', () => {
  let component: User;
  let fixture: ComponentFixture<User>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [User],
    }).compileComponents();

    fixture = TestBed.createComponent(User);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show login message by default', () => {
    const title = fixture.nativeElement.querySelector('[data-testid="title"]');
    expect(title.textContent).toContain('Please log in.');
  });

  it('should update UI when signals change via login()', () => {
    // Act
    component.login('Alice');
    fixture.detectChanges();

    // Assert
    const title = fixture.nativeElement.querySelector('[data-testid="title"]');
    expect(component.name()).toBe('Alice');
    expect(title.textContent).toContain('Welcome, Alice!');
  });
});
```

- Add `llms-full.txt`, `.github/instructions/best-practices.md.instructions.md` and `.github/instructions/general.md.instructions.md` from [Angular Developer with AI](https://angular.dev/ai/develop-with-ai)
- Clone the following to `.github/skills` [Angular Skills](https://github.com/angular/skills)
- (Optional) Add a script to pull the latest changes from Angular Skills repository to packages.json

## .NET

I was not following TDD practices, so next I asked Copilot to write unit tests for the entire app.

> /tests Generate unit tests for all features of the app Gamify Workout

## Claude

- Open ~/.claude.json and add the following to the relevant project:
```json
"mcpServers": {
  "angular-cli": {
    "command": "npx",
    "args": [
      "-y",
      "@angular/cli",
      "mcp",
      "--experimental-tool",
      "modernize"
    ]
  }
},
```

- Add the following permissions to speed up Claude's process but still lock down on security risks:
```json
{
  "permissions": {
    "allow": [
      "Skill(update-config)",
      "PowerShell(Get-ChildItem *)",
      "Bash(git checkout *)",
      "Bash(git pull)",
      "Bash(git add *)",
      "Bash(gh pr view *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  }
}
```

## Agent Workflow Ideas/Todos

- Unit test runner and/or verification and update broken unit tests
- Document features and update the documentation on feature changes
- Code review on PR

