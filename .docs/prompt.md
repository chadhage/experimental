# Prompt

You: Cloud Expert

Me: An AI developer who wishes to deploy his code for various scenarios.

Objective: I want to offer my code to my customers so they can run it in a variety of ways.This is a deployment prompt and the main app code will be in a separate repo.

- Option A: Customer pays a subscription fee to access a designer via a web browser, a client app, or a vs code extension, here they are able to connect to a data source that they must have access to over the public internet, such as a SQL Server, databricks, SharePoint, Excel Online, or a Snowflake instance for example, then design some queries, and publish an endpoint to be accessed publicly over the public internet using https and an access + auth token based security. The data may reside side by side with other data. The compute may run side by side with other customers' compute instances.

- Option B: Customer pays a subscription fee to access a designer via a web browser, a client app, or a vs code extension, where they are able to connect to a data source that they must have access to over a private IPSec tunnel or the public internet, such as a SQL Server, databricks, SharePoint, Excel Online, or a Snowflake instance for example, then design some queries, and publish an endpoint to be accessed privately over VPN or IPSec using https or public internet along with and an access + auth token based security. The data may reside side by side with other customer's data. The compute may run side by side with other customers' compute instances.

- Option C: Customer pays a subscription fee to access a designer via a web browser, a client app, or a vs code extension, where they are able to connect to a data source that they must have access to over a private IPSec tunnel or the public internet, such as a SQL Server, databricks, SharePoint, Excel Online, or a Snowflake instance for example, then design some queries, and publish an endpoint to be accessed privately over VPN or IPSec using https or public internet along with and an access + auth token based security. The data must reside in 100% isolation from any other customer data and the compute must run in 100% isolation from any other customers' compute instances.

- Option D: Customer pays a subscription fee to access a designer via a web browser, a client app, or a vs code extension, where they are able to connect to a data source that they must have access to over a private IPSec tunnel or the public internet, such as a SQL Server, databricks, SharePoint, Excel Online, or a Snowflake instance for example, then design some queries, and publish an endpoint to be accessed privately over VPN or IPSec using https or public internet along with and an access + auth token based security. Thea code must be deployed to the customer's tenant and subscription of choice on Azure, AWS, or GCP.

Output: All the scripts to successfully deploy 100% of the components that are required to produce the options described in the objective section. Some sample apps that can be used in place of my real app code.

- User flow: Given that the user has completed the purchasing process, when they select to deploy the product which they purchased, they are then presented with a series of questions, 1 question per turn, to collect the user's inputs and use them as parameters to guide the deployment flow.

- When the user selects a shared hosting and shared data residency, then collect preferred instance names and information to create the data source connection , and prepare the designer user interface, and details to prepare the public endpoint for consumption once the publishing it done. 

- When the user select an isolated hosting and data residency, then collect preferred instance names and information to create the tenant, subscriptions that are going to be dedicated to this customer, source data connections whether over the Internet or over IPSec via one of the 3 hyperscalers, then deploy the code to the newly provisioned tenant, subscription and resources then run the code to prepare the designer user interface so the user can begin to use it to publish an endpoint over the public internet or over a private IPSec.

- When the user select to have the code deployed onto their own tenant and subscription of choice on their cloud of choice, then collect preferred instance names and information to create the tenant, subscriptions that are going to be dedicated to this customer, source data connections whether over the Internet or over IPSec via one of the 3 hyperscalers, then deploy the code to the newly provisioned tenant, subscription and resources then run the code to prepare the designer user interface so the user can begin to use it to publish an endpoint over the public internet or over a private IPSec.

Format: Terraform, powershell, bash, yaml, github actions, markdown, docker files, html, css, javascript, typescript, C#, T-SQL