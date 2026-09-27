This is a simple demo of the blog features

# Markdown Header

- Supports markdown format e.g. lists
- Supports **bold**, italic, and __underscore__
- Supports markdown files, html, and typescript-rendered pages

## Code Blocks

Code block with line highlighting

```typescript line=4
const test = "hello";
console.log(test + " world");
// highlight the following line
console.info("this should be highlighted.");
const test2 = 5;
```

Code block with lines highlighted and offset
```typescript line=4-6 lineOffset=100
const test = "hello";
console.log(test + " world");
// highlight the following line
console.info("this should be highlighted.");
const test2 = 5;
const test3 = test + ", this is Johnny " + test2;
console.log("test", test3);
```

Code block from remote URL
```html source=https://raw.githubusercontent.com/jburditt/fullswing-angular-library/refs/heads/main/projects/fullswing-blog/src/app/app.html
```

## Mermaid Diagrams
```mermaid
architecture-beta
    group api(cloud)[Azure Architecture]
    service nosql(database)[CosmosDB] in api
    service server(server)[App Service] in api
    service db(database)[MSSQL] in api
    service blob(database)[Blob Storage] in api
    service message(cloud)[Message Queue] in api
    message:L <--> R:server
    message:B <--> T:nosql
    message:R <--> L:db
    blob:T --> B:server

    group blog(cloud)[Blog]
    service blogapp(server)[App Service] in blog
    service blogblob(database)[Blob Storage] in blog
    service deploy(internet)[GitHub Action] in blog
    deploy:T --> B:blogblob
    blogblob:R --> L:blogapp

    group wordpress(cloud)[Wordpress Azure Container App]
    service wordpress_php(server)[Wordpress Container] in wordpress
    service wordpress_db(database)[MySQL Container] in wordpress
    service wordpress_nginx(internet)[NginX Container] in wordpress
    service wordpress_certbot(disk)[Certbot Sidecar Container] in wordpress
    wordpress_php:T <--> B:wordpress_db
    wordpress_php:L <-- R:wordpress_nginx
    wordpress_certbot:T --> B:wordpress_nginx
```

