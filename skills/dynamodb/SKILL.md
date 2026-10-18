---
name: dynamodb
description: Create single table DynamoDB data models
license: Apache-2.0
---

# DynamoDB Single Table Design Skill

Create efficient single table data models for Amazon DynamoDB using best practices and proven design patterns.

## Overview

This skill guides you through the process of designing a single table data model for DynamoDB. It emphasizes understanding your application's data access patterns and structuring your table to optimize performance and scalability.

## Core Principles

## Workflow

### Step 1: Understand the application

Before modelling the data, you must understand the application. This involves understanding the entities and relationships in the application.

1. **Ask**: "Which project/system should I document?"
2. **Explore** codebase to understand domain, technology, and structure
3. **Search** for existing documentation in `docs/` folder
4. **Request** context from user:
   - Product Requirements Document (PRD)
   - Existing architecture diagrams or documentation
   - Links to relevant discussions (JIRA, Confluence, etc.)
5. **Create documentation page**: Create a new document to capture the data model design process and decisions. Use markdown format for easy readability and sharing. Make use of the documentation skill if required. Ensure the document is placed in the correct diataxis folder for future reference.

### Step 2: Create an entity-relationship diagram (ERD)

The first formal step is to create an Entity-Relationship Diagram (ERD), which is a diagram listing the different entities in the application and how they relate to each other. An ERD forces us to think about the data upfront and serves as a good artifact for people new to the application.

1. **Identify**: Identify all the entities in the application (e.g., User, Order, Product).
2. **Diagram entities**: Create a Mermaid diagram to represent the entities
3. **Define relationships**: Define the relationships between entities (e.g., one-to-many, many-to-many) and represent them in the diagram
4. **Review**: Review the ERD with stakeholders to ensure accuracy and completeness
5. **Iterate**: Update the ERD as needed based on feedback and new insights about the application data model

### Step 3: Write out all of your access patterns

In DynamoDB, we design our data to handle specific access patterns, rather than designing for future flexibility. Therefore, the next crucial step after creating an ERD is to define all of our data access patterns, which should be specific and thorough. We can approach this by either listing out all API endpoints (API-centric approach) or listing the information needed for each screen/URL in our application (UI-centric approach).

1. **API or UI centric**: Ask the user whether an API-centric or UI-centric approach should be used.
2. **List access patterns**: Write out all of the access patterns in a clear format, specifying:
   - The operation type (e.g., GetItem, Query, Scan)
   - The entity/entities involved
   - The attributes needed
   - Any filtering or sorting requirements
3. **Review**: Review the access patterns with stakeholders to ensure all necessary patterns are captured
4. **Iterate**: Update the access patterns as needed based on feedback and new insights about application usage

### Step 4: Model our primary key structure

The primary key is the foundation of our table, and modelling begins by deciding on the primary key structure. For a complex data model with "fetch many" access patterns (retrieving multiple entities or entity types), a composite primary key is usually necessary. This involves:

1. **Create entity chart**: Create a table listing each entity, its primary key structure, and any relevant notes. Use the HTML table format below as an example.
2. **Design PK and SK**: For each entity, design the Partition Key (PK) and Sort Key (SK) formats, ensuring they meet uniqueness and access pattern requirements.
3. **Use prefixes**: Implement primary key prefixes to distinguish between different entity types in the single table. e.g., CUSTOMER#&lt;CustomerId&gt;
4. **Review**: Review the primary key structure with stakeholders to ensure it meets all access patterns and uniqueness requirements.
5. **Iterate**: Update the primary key structure as needed based on feedback and new

This is an example of an HTML table format that clearly shows partition key, sort key, attributes and entities.

```html
<style type="text/css">
  .tg {
    border-collapse: collapse;
    border-spacing: 0;
  }
  .tg td {
    border-color: black;
    border-style: solid;
    border-width: 1px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    overflow: hidden;
    padding: 10px 5px;
    word-break: normal;
  }
  .tg th {
    border-color: black;
    border-style: solid;
    border-width: 1px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: normal;
    overflow: hidden;
    padding: 10px 5px;
    word-break: normal;
  }
  .tg .tg-y698 {
    background-color: transparent;
    border-color: inherit;
    text-align: left;
    vertical-align: top;
    font-weight: bold;
  }
  .tg .tg-0pky {
    border-color: inherit;
    text-align: left;
    vertical-align: top;
  }
</style>
<table class="tg">
  <thead>
    <tr>
      <th class="tg-y698" colspan="2"><span style="font-weight:bold">Primary key</span></th>
      <th class="tg-y698" colspan="2" rowspan="2"><span style="font-weight:bold">Attributes</span></th>
    </tr>
    <tr>
      <th class="tg-y698"><span style="font-weight:bold">Partition key: PK</span></th>
      <th class="tg-y698"><span style="font-weight:bold">Sort key: SK</span></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="tg-0pky" rowspan="2">JOBS</td>
      <td class="tg-0pky" rowspan="2">JOBS</td>
      <td class="tg-y698">JobsInProgress</td>
      <td class="tg-0pky"></td>
    </tr>
    <tr>
      <td class="tg-0pky">[12345,45678]</td>
      <td class="tg-0pky"></td>
    </tr>
    <tr>
      <td class="tg-0pky">JOB#12345</td>
      <td class="tg-0pky">JOB#12345</td>
      <td class="tg-y698">JobId</td>
      <td class="tg-y698">JobStatus</td>
    </tr>
    <tr>
      <td class="tg-0pky"></td>
      <td class="tg-0pky"></td>
      <td class="tg-0pky">12345</td>
      <td class="tg-0pky">IN_PROGRESS</td>
    </tr>
    <tr>
      <td class="tg-0pky" rowspan="2">JOB#45678</td>
      <td class="tg-0pky" rowspan="2">JOB#45678</td>
      <td class="tg-y698">JobId</td>
      <td class="tg-y698">JobStatus</td>
    </tr>
    <tr>
      <td class="tg-0pky">45678</td>
      <td class="tg-0pky">IN_PROGRESS</td>
    </tr>
  </tbody>
</table>
```

### Step 5: Satisfy additional access patterns with secondary indexes and streams

Once the primary key structure is defined, it will satisfy a number of access patterns. For any remaining read patterns, we should use secondary indexes. Rather than creating a new index for every pattern, we can overload secondary indexes using generic attribute names (e.g., GSI1PK and GSI1SK) to handle multiple access patterns within a single index. Additionally, DynamoDB Streams can be used for advanced scenarios like implementing reactive functionality.
