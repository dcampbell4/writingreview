// Fictional demo students and essays. All names and writing are invented.
// Logs are generated deterministically so the demo is identical on every load.

import { simulateSession } from './simulate.js';

const at = (iso) => Date.parse(iso);

const SAM_PRIOR = [
  {
    title: 'Loneliness in Of Mice and Men', date: '2026-02-10T10:00:00',
    text: `In Of Mice and Men by John Steinbeck, alot of the characters are lonely. George and Lennie are different becuase they have each other. Other people on the ranch like Crooks, Candy and Curley's wife dont have anybody. Steinbeck shows that loneliness makes people do things they normally wouldnt do.

Crooks is lonely becuase he is the only black man on the ranch and he has to live by himself in the barn. He tells Lennie "A guy needs somebody - to be near him" (72). This shows that Crooks really wants a friend even though he acts mean at first. When Lennie comes into his room he tries to push him away but then he starts talking to him alot. i think this is because he has not talked to anyone in a long time.

Candy is also lonely. After Carlson shoots his old dog he doesn't have anything left. That is why he wants to join George and Lennie and buy the farm with them. He says he will give them his money which is almost 350 dollars. This shows that Candy is scared of being alone and not being useful anymore.

Another example is Curley's wife. She is married but she is still lonely becuase Curley doesn't really care about her. She goes around the bunkhouse looking for someone to talk to. The men think she is trouble so they don't talk to her. When she talks to Lennie in the barn she tells him about wanting to be in the movies. This shows she has dreams too but nobody listens to her.

In conclusion, Steinbeck shows that loneliness is everywhere on the ranch. The characters who are alone are sad and they want someone to talk to. George and Lennie have something that the others want. At the end of the book George loses Lennie and now he is lonely too, which is the saddest part of the book.`,
  },
  {
    title: 'Greasers and Socs in The Outsiders', date: '2026-04-02T10:00:00',
    text: `The Outsiders by S.E. Hinton is about two groups called the Greasers and the Socs. The Greasers are poor and the Socs are rich. Ponyboy is a Greaser and he tells the story. Throughout the book Ponyboy learns that the Socs and the Greasers are not that different.

At the start Ponyboy hates the Socs becuase they jump Greasers and have alot of money. He says the Socs "jump us Greasers and wreck houses and throw beer blasts for kicks" (3). This shows how much he thinks the Socs are bad people. He doesn't think they have any problems at all.

This changes when Ponyboy talks to Cherry at the drive-in. Cherry is a Soc but she is nice to him. She tells him "Things are rough all over" (35). i didn't understand this quote at first but it means that the Socs have problems too. Ponyboy starts to see that being rich doesn't make you happy.

Another example is Randy. After the fight where Bob dies, Randy talks to Ponyboy in the car. He says he is tired of fighting and that it doesn't do anything. Ponyboy is surprised becuase Randy sounds just like a Greaser. This shows that people on both sides are tired of the fighting.

Also Johnny's letter at the end helps Ponyboy understand. Johnny tells him to "stay gold" which means to stay good and innocent. Ponyboy decides to write his story so other kids can understand what it is like.

In conclusion, The Outsiders shows that people are more alike than they think. Ponyboy learns that the Socs are people too and that money doesn't solve everything. I think this is a important lesson becuase alot of people judge others by what group they are in.`,
  },
  {
    title: 'Courage in To Kill a Mockingbird', date: '2026-05-20T10:00:00',
    text: `In To Kill a Mockingbird, Harper Lee shows different kinds of courage. Most people think courage means fighting or being strong but Atticus teaches Jem and Scout that it is more than that. The book shows courage through Atticus, Mrs. Dubose and even Scout.

The biggest example of courage is Atticus defending Tom Robinson. Everyone in Maycomb is against him and people call him names. Atticus knows he is probably going to lose but he does it anyway becuase it is the right thing to do. He tells Scout "Simply because we were licked a hundred years before we started is no reason for us not to try to win" (101). This shows that Atticus thinks doing the right thing is more important than winning.

Mrs. Dubose is another example. She is mean to Jem and Scout and says bad things about Atticus. But after she dies Atticus tells Jem she was fighting her addiction to morphine. He says she was the bravest person he ever knew. i was surprised by this becuase she seemed like a bad character. This shows that courage can be quiet and private.

Also Scout shows courage when she talks to Mr. Cunningham outside the jail. The mob wants to hurt Tom but Scout talks to Mr. Cunningham about his son Walter. She doesn't really know what is happening but she makes him feel ashamed and the mob leaves. This shows that even a kid can be brave.

In conclusion, Harper Lee shows that courage is not just about guns or fighting. Atticus, Mrs. Dubose and Scout all show courage in different ways. The book teaches that real courage is doing the right thing even when you know you will probably lose.`,
  },
];

const SAM_TYPED = `Lord of the Flies by William Golding is about a group of boys who get stuck on an island after a plane crash. At first they try to make rules and have a chief but things get worse and worse. Golding uses alot of symbols in the book to show what happens to people when there are no adults and no rules. In this essay i will talk about the conch, Simon and Piggys glasses and what they show about the boys.

The first symbol is the fire on the mountain. Ralph thinks the fire is the most important thing becuase it is their only way to get rescued. He says "We can help them to find us. If a ship comes near the island they may not notice us. So we must make smoke on top of the mountain" (38). This shows that Ralph is still thinking about going home and being normal again. But the other boys get bored of watching the fire and Jack's hunters let it go out when a ship goes past. Ralph is really angry about it and this is where the fight between Ralph and Jack really starts. I think the fire shows that keeping order takes work and most of the boys dont want to do the work.`;

const SAM_PASTED = `

Furthermore, the conch serves as a powerful symbol of civilization and democratic order. When Ralph first blows the conch, it gathers the scattered boys and establishes a sense of structure on the island. This highlights the profound complexity of human nature, as the boys initially embrace rules, order, and cooperation. However, as the novel progresses, the conch gradually loses its authority. This demonstrates not only the fragility of civilization, but also the ease with which humanity abandons its moral foundations. While the conch may appear to be a simple shell, it ultimately represents the delicate balance between order and chaos that exists within every society.

Moreover, the character of Simon underscores the multifaceted nature of goodness in a world increasingly consumed by fear. Simon is the only boy who recognizes that the beast is not an external creature, but rather an internal darkness. It is important to recognize that his encounter with the Lord of the Flies illustrates the broader implications of this realization. The pig's head, buzzing with flies, conveys the idea that evil is inherent in all people. This suggests that the true danger lies not in the jungle, but in the human heart. Additionally, Simon's tragic death emphasizes the destructive power of mob mentality, fear, and violence. At first glance, the boys' actions may seem like a momentary loss of control; however, they reveal a deeper truth about the human condition.

Similarly, the destruction of Piggy's glasses reinforces the theme of lost reason and knowledge. The glasses, which once allowed the boys to create fire, represent intellect, innovation, and progress. When Jack's tribe steals them, it highlights the triumph of brute force over rational thought. This allows the reader to understand the complexities inherent in human society, where power often overshadows wisdom. Ultimately, Golding demonstrates that without the structures of civilization, humanity's darker instincts inevitably prevail.

In conclusion, Golding's use of symbolism highlights the timeless struggle between civilization and savagery. Through the conch, Simon, and Piggy's glasses, the novel illustrates the profound and universal truths of human nature. Ultimately, Lord of the Flies serves as a powerful reminder that the line between order and chaos is fragile, and that the capacity for darkness exists within all of humanity. It is worth noting that this message remains relevant to society today, as people continue to grapple with questions of power, morality, and identity.`;

const AVERY_PRIOR = [
  {
    title: 'Guilt and imagination in Macbeth', date: '2026-03-03T13:00:00',
    text: `Macbeth is often read as a play about ambition, but I think it is just as much a play about the way guilt changes what a person can see. Early on, Macbeth is capable of imagining the consequences of murder in vivid detail; by the end, he can barely imagine anything at all.

Before killing Duncan, Macbeth talks himself in circles. He admits that Duncan "hath borne his faculties so meek" that his virtues "will plead like angels, trumpet-tongued" (1.7.17-19). The image is loud and crowded, almost as if his conscience is shouting over his ambition. Furthermore, the soliloquy never actually reaches a decision; Lady Macbeth has to finish the argument for him. What stands out to me is that his imagination is working against him here, not for him.

After the murder, that imagination turns into hallucination. Macbeth hears voices crying "Sleep no more" and cannot say "Amen" (2.2.33-45). Lady Macbeth dismisses this as "brainsickly" thinking, but the audience knows better: the play is showing us that guilt has a sound. Her own collapse later, when she sleepwalks and scrubs at invisible blood, suggests that the damage was simply delayed in her case rather than avoided.

By Act 5, Macbeth's language has gone flat. When he hears of his wife's death, he responds with "She should have died hereafter" and then drifts into the famous speech about "tomorrow, and tomorrow, and tomorrow" (5.5.17-19). It's a beautiful speech, but it's beautiful in a hollow way; life has become "a tale told by an idiot." He isn't really grieving - he has lost the ability to feel the weight of anything.

So the tragedy is not only that Macbeth becomes a tyrant. It's that the same vivid imagination that almost stopped him is gradually worn away, until nothing he does seems to matter to him at all. Shakespeare makes us watch a mind lose its colour.`,
  },
  {
    title: 'Language as control in Animal Farm', date: '2026-05-12T13:00:00',
    text: `Animal Farm is a short book, but Orwell packs a lot into the way language changes over the course of the story. The pigs don't take control through force alone; they take it by slowly rewriting what words are allowed to mean.

The clearest example is the Seven Commandments. At the start they are painted on the barn wall in big white letters, which makes them feel permanent. Over time, though, they keep shifting: "No animal shall sleep in a bed" quietly becomes "No animal shall sleep in a bed with sheets" (67). The animals half-remember the old version, but because they can't prove it, they doubt themselves instead of the pigs. I find this more frightening than the dogs, honestly.

Squealer is the engine behind this. Whenever something goes wrong, he arrives with numbers, charts and explanations that nobody can follow. Furthermore, he frames every question as a threat: "Surely, comrades, you do not want Jones back?" (35). The question isn't really a question - it closes down the conversation before it can start. Orwell highlights how easy it is to silence people when they are made to feel that disagreeing is dangerous.

Boxer shows the cost of all this. His two slogans, "I will work harder" and "Napoleon is always right," are the only ideas he ever holds onto, and the pigs are happy to let them replace his own judgement. When he is finally sold to the knacker, the other animals can read the side of the van, but only Benjamin understands what it means.

By the final scene the last commandment reads "All animals are equal but some animals are more equal than others" (90). It's a sentence that shouldn't make sense, and yet by then it does, because the animals have been trained to accept it. Orwell's warning, as I read it, is that the fight over words comes before the fight over everything else.`,
  },
];

const AVERY_PART1 = `Lord of the Flies is usually described as a story about boys turning savage, but what struck me most on this reading was how much of the novel is about who gets to speak. The conch is the obvious symbol of this, yet I think Golding is more interested in what happens to the conversations around it.

In the first assemblies, the conch works almost too well. Anyone holding it can talk, which sounds fair, but it also means the meetings go on and on without anyone deciding anything. Ralph notices this himself: `;

const AVERY_QUOTE = `"Things are breaking up. I don't understand why. We began well; we were happy" (Golding 82).`;

const AVERY_PART2 = ` Furthermore, the rules only work as long as everyone agrees to pretend the shell has power. The shell never had any power of its own; the boys lent it to it.

Jack understands this before anyone else. He doesn't argue with the conch so much as ignore it, and once he walks away with the hunters the assemblies lose their audience. Speaking still happens, but nobody is obliged to listen. I found it telling that Jack's new tribe replaces debate with chanting - "Kill the beast! Cut his throat! Spill his blood!" - because a chant is a kind of speech in which nobody has to think.

Piggy is the character who believes most in the conch, and he is also the one who is least allowed to speak. Even in the early chapters the boys laugh whenever he talks. By the time he holds up the conch at Castle Rock and asks "Which is better - to have rules and agree, or to hunt and kill?" the question is already hopeless. The rock that kills him also shatters the conch, and Golding describes it as exploding "into a thousand white fragments" (181).

What I take from this is that the island doesn't fall apart because the boys forget the rules. It falls apart because they stop needing to persuade each other. Once Jack can get what he wants without an argument, the conch is just a shell.`;

const JORDAN_TEXT = `Social media has become an integral part of modern life, shaping the way people communicate, learn, and form relationships. While social media may appear to be a harmless source of entertainment, it ultimately has a profound impact on the mental health of teenagers. This essay will explore the effects of social media on self-esteem, sleep, and relationships.

Firstly, social media affects how teenagers view themselves. Platforms that emphasize appearance encourage constant comparison with others. This highlights the broader implications of a culture that values image over substance. Furthermore, the pressure to receive likes and comments can lead to anxiety, insecurity, and self-doubt. It is important to recognize that these feelings are not only common, but also deeply harmful to young people.

Moreover, social media can disrupt healthy sleep patterns. Many teenagers scroll through their phones late at night, which reduces both the quality and quantity of their sleep. This demonstrates the complex relationship between technology and well-being. Additionally, a lack of sleep can affect concentration, mood, and academic performance.

Finally, social media changes the nature of relationships. Although online connections may seem to bring people closer together, they often replace meaningful face-to-face interaction. This suggests that society must rethink the role of technology in everyday life. In today's world, human beings need genuine connection more than ever.

In conclusion, social media has a significant effect on the mental health of teenagers. It influences self-esteem, sleep, and relationships in ways that are often overlooked. Ultimately, the challenge for society is to find a balance between the benefits of technology and the needs of the human experience.`;

function priorWithLog(sample, seed, wpm, revise) {
  const start = at(sample.date);
  const { log, finalText } = simulateSession({ start, seed, plan: [{ type: 'type', text: sample.text, wpm, revise, rethink: 0.05 }] });
  return { ...sample, text: finalText, log };
}

export function buildDemo() {
  const students = [
    { id: 'stu-sam', name: 'Sam Rivera', context: {}, notes: 'Fictional demo student.' },
    { id: 'stu-avery', name: 'Avery Chen', context: {}, notes: 'Fictional demo student. Only two baseline samples so far.' },
    { id: 'stu-jordan', name: 'Jordan Price', context: {}, notes: 'Fictional demo student. New this term: no baseline yet.' },
  ];

  const samples = [
    ...SAM_PRIOR.map((s, i) => ({ id: `sam-s${i + 1}`, studentId: 'stu-sam', authentic: true, include: true, ...priorWithLog(s, 11 + i, 26, 0.1) })),
    ...AVERY_PRIOR.map((s, i) => ({ id: `avery-s${i + 1}`, studentId: 'stu-avery', authentic: true, include: true, ...s })),
  ];

  const sam = simulateSession({
    start: at('2026-09-22T09:00:00'),
    seed: 42,
    plan: [
      { type: 'type', text: SAM_TYPED, wpm: 30, revise: 0.1, rethink: 0.06 },
      { type: 'pause', sec: 35 },
      { type: 'paste', text: SAM_PASTED },
      { type: 'pause', sec: 50 },
      { type: 'edit', find: 'talk about the conch, Simon and Piggys glasses', replace: 'talk about the fire, the conch, Simon and Piggys glasses' },
      { type: 'pause', sec: 40 },
    ],
  });

  const avery = simulateSession({
    start: at('2026-09-22T13:10:00'),
    seed: 7,
    plan: [
      { type: 'type', text: AVERY_PART1, wpm: 32, revise: 0.12, rethink: 0.1 },
      { type: 'paste', text: AVERY_QUOTE },
      { type: 'type', text: AVERY_PART2, wpm: 32, revise: 0.12, rethink: 0.1 },
    ],
  });

  const submissions = [
    { id: 'sub-sam-lotf', studentId: 'stu-sam', assignment: 'Lord of the Flies: Symbolism Essay', date: '2026-09-22T09:24:00', finalText: sam.finalText, log: sam.log, assignmentTerms: ['symbolism', 'civilization', 'savagery'] },
    { id: 'sub-avery-lotf', studentId: 'stu-avery', assignment: 'Lord of the Flies: Symbolism Essay', date: '2026-09-22T13:40:00', finalText: avery.finalText, log: avery.log, assignmentTerms: ['symbolism', 'civilization', 'savagery'] },
    { id: 'sub-jordan-media', studentId: 'stu-jordan', assignment: 'Persuasive Essay: Social Media', date: '2026-09-21T15:00:00', finalText: JORDAN_TEXT, log: null, assignmentTerms: [] },
  ];

  return { students, samples, submissions };
}
