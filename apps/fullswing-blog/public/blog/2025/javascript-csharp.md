Today I asked AI to create a JavaScript to C# cheat sheet in markdown format, since I come from a strong C# background and I'm working towards improving my JavaScript skills. When I don't know how to do something the JavaScript way, I find it helpful to think in terms of C# and then translate.

This cheat sheet helps developers transition from JavaScript to C# by comparing syntax and concepts side by side.

## 📌 Variable Declaration

| JavaScript             | C#                          |
|------------------------|-----------------------------|
| `let x = 5;`           | `int x = 5;`                |
| `const name = "John";` | `const string name = "John";` |
| `var isActive = true;` | `bool isActive = true;`     |

## 🔢 Data Types

| JavaScript     | C#        |
|----------------|-----------|
| Number         | int, float, double |
| String         | string    |
| Boolean        | bool      |
| Object         | class     |
| Array          | array or List<T> |
| null / undefined | null    |

## 🔁 Loops

| JavaScript                         | C#                                |
|------------------------------------|-----------------------------------|
| `for (let i = 0; i < 10; i++)`     | `for (int i = 0; i < 10; i++)`    |
| `while (x < 10)`                   | `while (x < 10)`                  |
| `do { ... } while (x < 10)`        | `do { ... } while (x < 10);`      |
| `for (let item of array)`          | `foreach (var item in array)`     |

## ✅ Conditionals

| JavaScript               | C#                        |
|--------------------------|---------------------------|
| `if (x > 5) { ... }`     | `if (x > 5) { ... }`       |
| `else if (x < 3)`        | `else if (x < 3)`          |
| `else`                   | `else`                     |
| `switch (value)`         | `switch (value)`           |

## 📦 Functions / Methods

| JavaScript                          | C#                                 |
|-------------------------------------|------------------------------------|
| `function greet(name) { ... }`      | `void Greet(string name) { ... }`  |
| `const add = (a, b) => a + b;`      | `int Add(int a, int b) => a + b;`  |
| `return value;`                     | `return value;`                    |

## 🧱 Classes

| JavaScript                          | C#                                 |
|-------------------------------------|------------------------------------|
| `class Person { constructor(name) { this.name = name; } }` | `class Person { public string Name; public Person(string name) { Name = name; } }` |

## 🔧 Properties and Methods

| JavaScript               | C#                          |
|--------------------------|-----------------------------|
| `this.name`              | `this.Name`                 |
| `getName()`              | `GetName()`                 |

## 🧪 Equality

| JavaScript     | C#        |
|----------------|-----------|
| `==`           | `==`      |
| `===`          | `==` (type-safe) |
| `!=`           | `!=`      |

## 📚 Miscellaneous

| JavaScript             | C#                          |
|------------------------|-----------------------------|
| `console.log("Hi")`    | `Console.WriteLine("Hi");`  |
| `typeof x`             | `x.GetType()`               |
| `JSON.stringify(obj)`  | `JsonConvert.SerializeObject(obj)` (via Newtonsoft.Json) |

---

Feel free to expand this with more advanced topics like async/await, LINQ, events, and delegates!
