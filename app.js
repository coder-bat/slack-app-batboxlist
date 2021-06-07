const {
	App
} = require("@slack/bolt");
require("dotenv").config();
const {
	WebClient,
	LogLevel
} = require("@slack/web-api");
const https = require('https');
const mysql = require('mysql');
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);
// Initializes your app with your bot token and signing secret
const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
});

var connection = mysql.createConnection({
	host: process.env.DBHOST,
	user: process.env.DBUSER,
	password: process.env.DBPASS,
	database: process.env.DBNAME
});


connection.connect(function (err) {
	if (err) console.error(err);
	else console.log("Connected!");
});

(async () => {
	const port = 3000
	// Start your app
	await app.start(process.env.PORT || port);
	console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
})();

app.command("/add", async ({
	command,
	ack,
	say
}) => {
	try {
		await ack();
		if (typeof (command.text) == undefined || command.text == '') {
			web.chat.postMessage({
				"text": "Add task name",
				"channel": command.channel_id,
				"replace_original": "true",
				blocks: [{
					"type": "input",
					"block_id": 'task_name',
					"element": {
						"type": "plain_text_input"
					},
					"label": {
						"type": "plain_text",
						"text": "Please add task name",
						"emoji": true
					}
				},
				{
					"type": "actions",
					"elements": [{
						"type": "button",
						action_id: 'save_task_name',
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "Save"
						},
						"style": "primary",
						"value": "save_task_name"
					}]
				}
				],
			});
		} else {
			web.chat.postMessage({
				"text": "Assign task",
				"channel": command.channel_id,
				"replace_original": "true",
				blocks: [{
					"type": "input",
					"block_id": "task_name",
					"label": {
						"type": "plain_text",
						"text": "Task name"
					},
					"element": {
						"type": "plain_text_input",
						"action_id": "plain_input",
						"initial_value": `${command.text}`
					}
				},
				{
					"type": "input",
					"block_id": 'user_list',
					"element": {
						"type": "multi_users_select"
					},
					"label": {
						"type": "plain_text",
						"text": "Assign task to",
						"emoji": true
					}
				},
				{
					"type": "actions",
					"elements": [{
						"type": "button",
						action_id: 'task_ass',
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "Save"
						},
						"style": "primary",
						"value": "assign_task"
					}]
				}
				]
			});
		}
	} catch (error) {
		console.log("err")
		console.error(error);
	}
});

app.action('save_task_name', async ({
	body,
	ack,
	say
}) => {
	await ack();
	var taskname = getValueFromState(body, 'task_name');
	console.log(taskname);
	web.chat.update({
		"text": "Assign task",
		'response_type': 'ephemeral',
		'ts': body.container.message_ts,
		'channel': body.container.channel_id,
		'replace_original': true,
		blocks: [{
			"type": "input",
			"block_id": "task_name",
			"label": {
				"type": "plain_text",
				"text": "Task name"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "plain_input",
				"initial_value": `${taskname}`
			}
		},
		{
			"type": "input",
			"block_id": 'user_list',
			"element": {
				"type": "multi_users_select"
			},
			"label": {
				"type": "plain_text",
				"text": "Assign task to",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [{
				"type": "button",
				action_id: 'task_ass',
				"text": {
					"type": "plain_text",
					"emoji": true,
					"text": "Save"
				},
				"style": "primary",
				"value": "assign_task"
			}]
		}
		]
	})
});

app.action('task_ass', async ({
	body,
	ack,
	say
}) => {
	var obj = body.state.values;
	console.log(body.message.blocks);
	// console.log('task assigned', getValueFromState(body, 'task_name'));
	var taskname = getValueFromState(body, 'task_name');
	var assigned_user = getValueFromState(body, 'user_list', 'user_arr')[0];
	await ack();

	if (!assigned_user) {
		say({
			"text": "Please select user",
			"replace_original": "false",
		});
	} else {
		console.log(body);
		var sql = `INSERT INTO tasks (taskname, added_by, added_for, added_on, channel_name, status, status_changed_on) 
	VALUES ('${taskname}', '${body.user.id}', '${assigned_user}', '${Date.now()}', '${body.channel.name}', 'pending', ${Date.now()})`;
		connection.query(sql, function (err, result) {
			if (err) throw err;
			web.chat.update({
				"text": "Task added",
				'response_type': 'ephemeral',
				'ts': body.container.message_ts,
				'channel': body.container.channel_id,
				'replace_original': true,
				'delete_original': true,
				'blocks': [{
					"type": "section",
					"text": {
						"type": "plain_text",
						"text": "Task added :)",
						"emoji": true
					}
				}]
			});
			console.log("1 record inserted");
		});
	}
});

app.command("/list", async ({
	command,
	ack,
	say
}) => {
	try {
		await ack();
		var userid = command.user_id;
		var tasksList = [];
		var doneTasks = [];
		var sql = `SELECT * FROM tasks WHERE  
		added_for="${userid}"`;
		connection.query(sql, function (err, result) {
			if (err) throw err;
			result.forEach(element => {
				tasksList.push({
					"value": `${element.taskid}`,
					"text": {
						"type": element.status == "done" ? "mrkdwn" : "plain_text",
						"text": element.status == "done" ? `~${element.taskname}~` : `${element.taskname}`,
					}
				});
			});
			var perChunk = 10;

			var tasksListInChunk = tasksList.reduce((resultArray, item, index) => {
				const chunkIndex = Math.floor(index / perChunk)

				if (!resultArray[chunkIndex]) {
					resultArray[chunkIndex] = [] // start a new chunk
				}

				resultArray[chunkIndex].push(item)

				return resultArray
			}, []);

			tasksListInChunk.forEach((item, index) => {
				doneTasks[index] = item.filter(task => task.text.type === "mrkdwn");
			})

			console.log(doneTasks);

			var blocks = [];

			blocks.push({
				"type": "section",
				"block_id": `task_list_header`,
				"text": {
					"type": "plain_text",
					"text": `List of all tasks for <@${command.user_name}>`
				},
			});


			tasksListInChunk.forEach(function (item, index) {
				console.log(item);
				if (doneTasks[index]) {
					blocks.push({
						"type": "section",
						"block_id": `task_list_${index}`,
						"text": {
							"type": "plain_text",
							"text": ' '
						},
						"accessory": {
							"type": "checkboxes",
							"action_id": "task_status_update",
							"initial_options": doneTasks[index],
							"options": tasksListInChunk[index],
						}
					});
				}
				else {
					blocks.push({
						"type": "section",
						"block_id": `task_list_${index}`,
						"text": {
							"type": "plain_text",
							"text": ' '
						},
						"accessory": {
							"type": "checkboxes",
							"action_id": "task_status_update",
							"options": tasksListInChunk[index],
						}
					});
				}
			});

			web.chat.postMessage({
				"text": "List of all tasks",
				"channel": command.channel ? command.channel.id : command.channel_id,
				"text": "List of all tasks",
				blocks,
			});
		});
	} catch (error) {
		console.log("err")
		console.error(error);
	}
});

app.action('task_status_update', async ({
	body,
	ack,
	say
}) => {
	var obj = body;
	console.log(body);
	var cbs = getSelectedCB(body);
	var allCbsInBlock = body.message.blocks.filter(obj => {
		return obj.block_id === body.actions[0].block_id
	})[0].accessory.options;
	await ack();
	// console.log(cbs);

	if (cbs && allCbsInBlock) {
		var doneTasksIDs = [];
		var pendingTaskIDs = [];
		allCbsInBlock.forEach((item, index) => {
			if (cbs.some(cb => cb.value === item.value)) {
				doneTasksIDs.push(`${item.value}`);
			}
			else {
				pendingTaskIDs.push(`${item.value}`);
			}
		});

		var sql = `UPDATE tasks SET status='done',status_changed_on=${Date.now()}  WHERE taskid IN (${doneTasksIDs.join(',')})`
		connection.query(sql, function (err, result) {
			if (err) throw err;
			console.log("done records updated");
			var sql2 = `UPDATE tasks SET status='pending',status_changed_on=${Date.now()} WHERE taskid IN (${pendingTaskIDs.join(',')})`
			connection.query(sql2, function (err, result2) {
				if (err) throw err;
				console.log("pending records updated");
				var userid = body.user.id;
				var username = body.user.username;
				var tasksList = [];
				var doneTasks = [];
				var sql = `SELECT * FROM tasks WHERE  
				added_for="${userid}"`;
				connection.query(sql, function (err, result) {
					if (err) throw err;
					result.forEach(element => {
						tasksList.push({
							"value": `${element.taskid}`,
							"text": {
								"type": element.status == "done" ? "mrkdwn" : "plain_text",
								"text": element.status == "done" ? `~${element.taskname}~` : `${element.taskname}`,
							}
						});
					});
					var perChunk = 10;

					var tasksListInChunk = tasksList.reduce((resultArray, item, index) => {
						const chunkIndex = Math.floor(index / perChunk)

						if (!resultArray[chunkIndex]) {
							resultArray[chunkIndex] = [] // start a new chunk
						}

						resultArray[chunkIndex].push(item)

						return resultArray
					}, []);

					tasksListInChunk.forEach((item, index) => {
						doneTasks[index] = item.filter(task => task.text.type === "mrkdwn");
					})

					console.log(doneTasks);

					var blocks = [];

					blocks.push({
						"type": "section",
						"block_id": `task_list_header`,
						"text": {
							"type": "plain_text",
							"text": `List of all tasks for <@${username}>`
						},
					});


					tasksListInChunk.forEach(function (item, index) {
						console.log(item);
						if (doneTasks[index]) {
							blocks.push({
								"type": "section",
								"block_id": `task_list_${index}`,
								"text": {
									"type": "plain_text",
									"text": ' '
								},
								"accessory": {
									"type": "checkboxes",
									"action_id": "task_status_update",
									"initial_options": doneTasks[index],
									"options": tasksListInChunk[index],
								}
							});
						}
						else {
							blocks.push({
								"type": "section",
								"block_id": `task_list_${index}`,
								"text": {
									"type": "plain_text",
									"text": ' '
								},
								"accessory": {
									"type": "checkboxes",
									"action_id": "task_status_update",
									"options": tasksListInChunk[index],
								}
							});
						}
					});

					web.chat.update({
						"text": "List of all tasks",
						"ts": body.message.ts,
						"channel": body.channel.id,
						blocks,
					});
				});
			});

		});
	}
});

function getValueFromState(body, block_id, type = 'default', multiple_blocks = false) {
	if (type == 'user_arr') {
		var obj = body.state.values[block_id];
		return obj[Object.keys(obj)[0]].selected_users;
	}

	else if (type == 'checkboxes') {
		var obj = body.state.values;
		var selectedOptions = [];
		for (const single_block in obj) {
			var temp = obj[single_block].task_status_update.selected_options;
			selectedOptions = selectedOptions.concat(temp);
		}
		return selectedOptions;
	}

	else {
		var obj = body.state.values[block_id];
		if (obj[Object.keys(obj)[0]]) {
			return obj[Object.keys(obj)[0]].value;
		} else {
			var arr = body.message.blocks;
			var val = arr.filter(item => item.block_id === 'task_name').map(item => item.element.initial_value);
			return val[0];
		}
	}
}

function getSelectedCB(body) {
	if (body.actions.length > 0) {
		var selectedOptions = [];
		return body.actions[0].selected_options;
	};
	return null;
}